import React, { useRef } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { formatNumber } from '@utils/functions';
import { colors } from '@utils/theme';
import { Ask, Bid, OrderType } from '@utils/types';

interface Props {
  order: Bid | Ask;
  index: number;
  total: number;
  orderType: OrderType.bid | OrderType.ask;
}

export const Order: React.FC<Props> = ({ order, index, total, orderType }) => {
  const coloredBarWidth = (order.total * 100) / total;
  const coloredBarStyle: ViewStyle = useRef({
    left: 0,
    zIndex: 1,
    backgroundColor: orderType === OrderType.bid ? colors.green : colors.red,
    width: coloredBarWidth,
    height: '100%',
    opacity: 0.4,
  }).current;

  return (
    <View style={styles.orderRow}>
      <View style={[coloredBarStyle, { position: 'absolute' }]} />
      <Text
        style={[
          styles.price,
          {
            color: orderType === OrderType.bid ? colors.green : colors.red,
            flex: 0.28,
          },
        ]}
        key={`${order.price}/${index}`}
      >
        {formatNumber(order.price)}
      </Text>
      <Text
        style={[
          styles.price,
          {
            flex: 0.34,
            color: '#fff',
          },
        ]}
      >
        {order.size.toLocaleString()}
      </Text>
      <Text style={[styles.price, { flex: 0.38, color: '#fff' }]}>
        {order.total.toLocaleString()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  orderRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
  },
  price: {
    textTransform: 'uppercase',
    fontSize: 14,
    fontWeight: '600',
    alignSelf: 'center',
    textAlign: 'right',
    zIndex: 2,
    lineHeight: 25,
  },
});
