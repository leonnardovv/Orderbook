export interface SocketMessage {
  product_id: 'PI_XBTUSD';
  feed: 'book_ui_1_snapshot' | 'book_ui_1';
  bids: Array<[number, number]>;
  asks: Array<[number, number]>;
  event: 'unsubscribed';
}

export interface Bid {
  price: number;
  size: number;
  total: number;
}

export interface Ask {
  price: number;
  size: number;
  total: number;
}

export enum OrderType {
  bid = 'bid',
  ask = 'ask',
}

export enum ArrayTypes {
  bids = 'bids',
  asks = 'asks',
}
