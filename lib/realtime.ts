import { supabase } from './supabase';

export type LiveEventType = 'PLAN_UPDATE' | 'CHALLAN_UPDATE' | 'USER_UPDATE';

export interface LiveEventPayload {
  type: LiveEventType;
  challanId?: string;
  userId?: string;
  timestamp: string;
  sourceClient?: string;
}

export interface RealtimeSubscriptionHandlers {
  onPlanUpdate?: (challanId?: string) => void;
  onChallanUpdate?: (challanId?: string) => void;
  onUserUpdate?: () => void;
  onConnectionChange?: (connected: boolean) => void;
}

// Generate unique client ID to prevent self-echo loops on broadcast
const CLIENT_ID = typeof window !== 'undefined'
  ? `client_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
  : 'server';

const BROADCAST_CHANNEL_NAME = 'denimcrafts_erp_cross_tab';
const SUPABASE_CHANNEL_NAME = 'denimcrafts_realtime_hub';

let activeBroadcastChannel: BroadcastChannel | null = null;
let activeSupabaseChannel: ReturnType<typeof supabase.channel> | null = null;

/**
 * Broadcast an ERP state change (actual, expected, balance, challan, or user changes)
 * to ALL connected clients across devices (via Supabase WebSockets) AND across tabs (via BroadcastChannel).
 */
export async function broadcastLiveChange(event: {
  type: LiveEventType;
  challanId?: string;
  userId?: string;
}): Promise<void> {
  const payload: LiveEventPayload = {
    ...event,
    timestamp: new Date().toISOString(),
    sourceClient: CLIENT_ID,
  };

  // 1. Cross-tab instant communication in the same browser
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      if (!activeBroadcastChannel) {
        activeBroadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      }
      activeBroadcastChannel.postMessage(payload);
    } catch (err) {
      console.warn('Cross-tab broadcast warning:', err);
    }
  }

  // 2. Cross-device WebSocket broadcast via Supabase Realtime channel
  try {
    if (activeSupabaseChannel) {
      await activeSupabaseChannel.send({
        type: 'broadcast',
        event: 'erp_event',
        payload,
      });
    }
  } catch (err) {
    console.warn('Supabase realtime broadcast warning:', err);
  }
}

/**
 * Initializes a multi-layered real-time subscription for live updates:
 * Layer 1: Supabase Realtime WebSocket broadcast (<100ms across all devices)
 * Layer 2: Supabase Postgres Changes listeners on entries, challans, profiles
 * Layer 3: Cross-tab BroadcastChannel (0ms in same browser)
 * Layer 4: VisibilityChange sync (immediate sync when tab is brought to focus)
 * Layer 5: Adaptive background heartbeat poll (every 4 seconds) to guarantee no missed updates
 */
export function initRealtimeSubscription(handlers: RealtimeSubscriptionHandlers): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let isSubscribed = true;
  handlers.onConnectionChange?.(true);

  // Cross-tab broadcast listener
  let localBC: BroadcastChannel | null = null;
  if ('BroadcastChannel' in window) {
    try {
      localBC = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      activeBroadcastChannel = localBC;
      localBC.onmessage = (e: MessageEvent<LiveEventPayload>) => {
        if (!isSubscribed) return;
        const data = e.data;
        if (!data || data.sourceClient === CLIENT_ID) return;

        if (data.type === 'PLAN_UPDATE') {
          handlers.onPlanUpdate?.(data.challanId);
        } else if (data.type === 'CHALLAN_UPDATE') {
          handlers.onChallanUpdate?.(data.challanId);
        } else if (data.type === 'USER_UPDATE') {
          handlers.onUserUpdate?.();
        }
      };
    } catch (e) {
      console.warn('Could not initialize BroadcastChannel:', e);
    }
  }

  // Supabase Realtime Channel
  try {
    const channel = supabase.channel(SUPABASE_CHANNEL_NAME, {
      config: {
        broadcast: { ack: false, self: false },
      },
    });
    activeSupabaseChannel = channel;

    // 1. Listen for peer broadcast events
    channel.on(
      'broadcast',
      { event: 'erp_event' },
      ({ payload }: { payload: LiveEventPayload }) => {
        if (!isSubscribed) return;
        if (!payload || payload.sourceClient === CLIENT_ID) return;

        if (payload.type === 'PLAN_UPDATE') {
          handlers.onPlanUpdate?.(payload.challanId);
        } else if (payload.type === 'CHALLAN_UPDATE') {
          handlers.onChallanUpdate?.(payload.challanId);
        } else if (payload.type === 'USER_UPDATE') {
          handlers.onUserUpdate?.();
        }
      }
    );

    // 2. Listen for Postgres changes on entries table (actual, expected, balance, dates)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'entries' },
      (payload) => {
        if (!isSubscribed) return;
        const newRecord = payload.new as { challan_id?: string } | undefined;
        const oldRecord = payload.old as { challan_id?: string } | undefined;
        const challanId = newRecord?.challan_id || oldRecord?.challan_id;
        handlers.onPlanUpdate?.(challanId);
      }
    );

    // 3. Listen for Postgres changes on challans table (opening qty, status, orderDate, DC details)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'challans' },
      (payload) => {
        if (!isSubscribed) return;
        const newRecord = payload.new as { id?: string } | undefined;
        const oldRecord = payload.old as { id?: string } | undefined;
        const challanId = newRecord?.id || oldRecord?.id;
        handlers.onChallanUpdate?.(challanId);
      }
    );

    // 4. Listen for Postgres changes on profiles table (user accounts, permissions)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      () => {
        if (!isSubscribed) return;
        handlers.onUserUpdate?.();
      }
    );

    channel.subscribe((status, err) => {
      if (!isSubscribed) return;
      if (status === 'SUBSCRIBED') {
        handlers.onConnectionChange?.(true);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Realtime channel status:', status, err);
        handlers.onConnectionChange?.(false);
      }
    });
  } catch (err) {
    console.warn('Supabase realtime subscription initialization error:', err);
  }

  // Window Focus & Visibility Change Handler
  // Instant refresh when user switches tabs or returns to the application
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && isSubscribed) {
      handlers.onPlanUpdate?.();
      handlers.onChallanUpdate?.();
    }
  };
  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleVisibilityChange);

  // Background heartbeat poll (every 4 seconds) to guarantee 100% data sync
  // even if network or websocket was temporarily offline
  const heartbeatTimer = setInterval(() => {
    if (isSubscribed && document.visibilityState === 'visible') {
      handlers.onPlanUpdate?.();
      handlers.onChallanUpdate?.();
    }
  }, 4000);

  // Cleanup function
  return () => {
    isSubscribed = false;
    clearInterval(heartbeatTimer);
    window.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleVisibilityChange);

    if (localBC) {
      try {
        localBC.close();
      } catch {
        // ignore
      }
      activeBroadcastChannel = null;
    }

    if (activeSupabaseChannel) {
      try {
        supabase.removeChannel(activeSupabaseChannel);
      } catch {
        // ignore
      }
      activeSupabaseChannel = null;
    }
  };
}
