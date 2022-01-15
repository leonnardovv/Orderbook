import React, { useRef, useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import AVLTree from 'avl';
import { useWebSocketConnection } from '@hooks/useWebSocketConnection';
import { ArrayTypes, Ask, Bid, OrderType, SocketMessage } from '@utils/types';
import { useAppState } from '@hooks/useAppState';
import { colors } from '@utils/theme';

import { Order } from './components/Order';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const numLevels = 25;
const shownElements = 12;

export const OrderBook = () => {
  /**
   * Using AVL Tree to fast sorting of the order's bids and asks
   * by the key of the node
   * @property key -> price
   * @property data -> size
   */
  const bidsTree = useRef(new AVLTree<number, number>((a, b) => b - a)).current; // i.e [33, 5, 2, 0, -10]
  const asksTree = useRef(new AVLTree<number, number>()).current; // i.e [-10, 0, 2, 5, 33]
  const [bids, setBids] = useState<Bid[]>([]);
  const [asks, setAsks] = useState<Ask[]>([]);

  const [time, setTime] = useState(Date.now());
  const [spread, setSpread] = useState(0);
  const [spreadPercentage, setSpreadPercentage] = useState(0);
  const [asksTotal, setAsksTotal] = useState(0);
  const [bidsTotal, setBidsTotal] = useState(0);
  const [clearedState, setClearedState] = useState(false);

  const { wsRef, unsubscribe, subscribed, toggleProductId, subscribe } =
    useWebSocketConnection();
  const { appState } = useAppState();

  useEffect(() => {
    onMessageReceived();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribed]);

  useEffect(() => {
    if (appState === 'background') {
      unsubscribe();
      clearTreesAndState();
      setSpread(0);
      setSpreadPercentage(0);
      setClearedState(true);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState]);

  useEffect(() => {
    const interval = setInterval(() => setTime(Date.now()), 1000);
    updateTreesAndState();

    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);

  const updateTreesAndState = () => {
    const tempBids: Bid[] = [];
    const tempAsks: Ask[] = [];

    let currentBidsTotal = 0;
    bidsTree.forEach((node, index) => {
      if (node.key && node.data && index < shownElements) {
        currentBidsTotal += node.data;
        tempBids.push({
          price: node.key,
          size: node.data,
          total: currentBidsTotal,
        });
      }
    });

    let currentAsksTotal = 0;
    asksTree.forEach((node, index) => {
      if (node.key && node.data && index < shownElements) {
        currentAsksTotal += node.data;
        tempAsks.push({
          price: node.key,
          size: node.data,
          total: currentAsksTotal,
        });
      }
    });

    setBidsTotal(currentBidsTotal);
    setAsksTotal(currentAsksTotal);

    setBids(tempBids);
    setAsks(tempAsks.reverse());

    /**
     * @description
     * tree.min() returns the key by minimum index, not by minimum value. And
     * because we have reverse sort at the declaration of asks tree, we
     * have to use bidsTree.min() as maximum price from bids tree because
     * the maximum price is the minimum key (see the bidsTree declaration)
     */
    const maxBidsPrice = bidsTree.min();
    const minAsksPrice = asksTree.min();

    if (minAsksPrice && maxBidsPrice) {
      const tempSpread = minAsksPrice - maxBidsPrice;
      setSpread(tempSpread);
      const tempSpreadPercentage =
        Math.round((tempSpread / minAsksPrice + Number.EPSILON) * 100 * 100) /
        100;

      setSpreadPercentage(tempSpreadPercentage);
    }
  };

  const onMessageReceived = () => {
    if (wsRef) {
      wsRef.onmessage = (message) => {
        try {
          const socketMessage: SocketMessage = JSON.parse(message.data);
          const {
            bids: currentBids,
            asks: currentAsks,
            feed,
            event,
          } = socketMessage;

          if (currentBids && currentAsks) {
            if (feed && feed === 'book_ui_1_snapshot') {
              currentBids.forEach((bid) => {
                const [price, size] = bid;
                // removing bids with size 0
                if (size > 0) {
                  bidsTree.insert(price, size);
                }
              });
              currentAsks.forEach((ask) => {
                const [price, size] = ask;
                // removing asks with size 0
                if (size > 0) {
                  asksTree.insert(price, size);
                }
              });
            } else if (feed && feed === 'book_ui_1') {
              updateNodes(currentBids, ArrayTypes.bids);
              updateNodes(currentAsks, ArrayTypes.asks);
            }
          } else if (event && event === 'unsubscribed') {
            clearTreesAndState();
          }
          // setIsLoading(false);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Error: ', error);
        }
      };
    }
  };

  const clearTreesAndState = () => {
    bidsTree.clear();
    asksTree.clear();
    //
  };

  /**
   *
   * @param currentPrice - the price of the bid/ask
   * @param currentSize - the size of the bid/ask
   * @param avlTreeName - the name of the tree we use to check similar keys(prices)
   *
   * @description
   * We search for similar keys(prices) in the tree nodes. If we find similar keys(prices), we
   * check if the size is 0. If yes, we remove the key(price). If not, we update the node data(size)
   * with the new size.
   */
  const updateSimilarPrice = (
    currentPrice: number,
    currentSize: number,
    avlTreeName: ArrayTypes.bids | ArrayTypes.asks,
  ) => {
    const currentTree = avlTreeName === ArrayTypes.bids ? bidsTree : asksTree;
    const foundPrice = currentTree.find(currentPrice);

    if (!foundPrice) {
      return false;
    }
    currentTree.remove(currentPrice);
    if (currentSize > 0) {
      currentTree.insert(currentPrice, currentSize);
    }
    return true;
  };

  /**
   * @param array - the specific array we want to map(bids or asks)
   * @param data - new size
   *
   * @description
   * Every data that comes new will be checked in this function.
   * On bids -> If the new data is >= the tree's lowest price, we will remove the lowest price and add the new values.
   * On bids -> If the new data is <= the tree's biggest price, we will remove the biggest price and add the new values.
   * AVL tree will order the nodes automatically by the key(price)
   */
  const updateNodes = (
    array: Array<[number, number]>,
    arrayType: ArrayTypes.bids | ArrayTypes.asks,
  ) => {
    const currentTree = arrayType === ArrayTypes.bids ? bidsTree : asksTree;
    array.forEach((item) => {
      const [price, size] = item;
      if (!updateSimilarPrice(price, size, arrayType)) {
        const numNodes = currentTree.keys().length;
        const minPrice = currentTree.min();
        let maxPrice;
        if (arrayType === ArrayTypes.bids) {
          maxPrice = currentTree.min(); // again we use bidsTree.min() as maxValue
        } else {
          maxPrice = currentTree.max();
        }

        if (numNodes < numLevels && size > 0) {
          currentTree.insert(price, size);
        } else if (
          numNodes === numLevels &&
          size > 0 &&
          minPrice &&
          price >= minPrice &&
          arrayType === ArrayTypes.bids
        ) {
          currentTree.remove(minPrice);
          currentTree.insert(price, size);
        } else if (
          numNodes === numLevels &&
          size > 0 &&
          maxPrice &&
          price <= maxPrice &&
          arrayType === ArrayTypes.asks
        ) {
          currentTree.remove(maxPrice);
          currentTree.insert(price, size);
        }
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.orderBook}>
        <Text style={styles.pageTitle}>Order Book</Text>
        {clearedState ? (
          <Text
            style={{
              alignSelf: 'center',
              marginTop: 0.35 * windowHeight,
              color: colors.white,
              fontSize: 20,
            }}
          >
            Disconnected
          </Text>
        ) : (
          <>
            <View style={styles.orderBookHeader}>
              <Text style={[styles.columnTitle, { flex: 0.28 }]}>Price</Text>
              <Text style={[styles.columnTitle, { flex: 0.34 }]}>Size</Text>
              <Text style={[styles.columnTitle, { flex: 0.38 }]}>Total</Text>
            </View>
            {asks.map((ask, index) => (
              <Order
                key={`Ask/${ask.price}/${ask.size}/${index.toString()}}`}
                order={ask}
                orderType={OrderType.ask}
                index={index}
                total={asksTotal > bidsTotal ? asksTotal : bidsTotal}
              />
            ))}
            <View style={styles.middleContainer}>
              <Text style={[styles.middleContainerTitle]}>
                Spread: {spread.toFixed(1)} ({spreadPercentage}%)
              </Text>
            </View>
            <View>
              {bids.map((bid, index) => (
                <Order
                  key={`Bid/${bid.price}/${bid.size}/${index.toString()}`}
                  order={bid}
                  orderType={OrderType.bid}
                  index={index}
                  total={asksTotal > bidsTotal ? asksTotal : bidsTotal}
                />
              ))}
            </View>
          </>
        )}
        <TouchableOpacity
          onPress={() => {
            if (clearedState && wsRef) {
              subscribe(wsRef);
              setClearedState(false);
            } else {
              unsubscribe();
              toggleProductId();
            }
          }}
          style={styles.toggleButton}
        >
          <Text style={styles.toggleText}>
            {clearedState ? 'Reload' : 'Toggle Feed'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141723',
  },
  orderBook: {
    flex: 1,
  },
  pageTitle: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 18,
    marginLeft: 10,
    marginBottom: 2,
  },
  orderBookHeader: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#3b414e',
  },
  columnTitle: {
    textTransform: 'uppercase',
    color: '#3b414e',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'right',
  },

  middleContainer: {
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#3b414e',
  },
  middleContainerTitle: {
    color: '#3b414e',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  toggleButton: {
    backgroundColor: '#5741d9',
    width: 0.35 * windowWidth,
    height: 35,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    position: 'absolute',
    bottom: 20,
  },
  toggleText: {
    color: '#fff',
    fontSize: 16,
  },
});
