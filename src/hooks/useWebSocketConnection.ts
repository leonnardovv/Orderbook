import { useEffect, useRef, useState } from 'react';

const subscribeCall = {
  event: 'subscribe',
  feed: 'book_ui_1',
};
const unsubscribeCall = {
  event: 'unsubscribe',
  feed: 'book_ui_1',
};

export const useWebSocketConnection = () => {
  const [subscribed, setSubscribed] = useState(false);
  const [productId, setProductId] = useState<'PI_XBTUSD' | 'PI_ETHUSD'>(
    'PI_XBTUSD',
  );
  const [isLoading, setIsLoading] = useState(true);

  const wsRef = useRef<WebSocket>();

  useEffect(() => {
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const connect = () => {
    if (!wsRef.current) {
      const ws = new WebSocket('wss://www.cryptofacilities.com/ws/v1'); // should add to .env
      ws.onopen = () => {
        wsRef.current = ws;
        subscribe(ws);
      };
    } else {
      subscribe(wsRef.current);
    }
  };

  const subscribe = (ws: WebSocket) => {
    ws.send(JSON.stringify({ ...subscribeCall, product_ids: [productId] }));
    setSubscribed(true);
  };

  const unsubscribe = () => {
    setIsLoading(true);
    wsRef.current?.send(
      JSON.stringify({ ...unsubscribeCall, product_ids: [productId] }),
    );
    setSubscribed(false);
  };

  const toggleProductId = () => {
    setProductId(productId === 'PI_XBTUSD' ? 'PI_ETHUSD' : 'PI_XBTUSD');
  };

  return {
    wsRef: wsRef.current,
    connect,
    subscribe,
    unsubscribe,
    productId,
    subscribed,
    isLoading,
    setIsLoading,
    toggleProductId,
  };
};
