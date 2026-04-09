import React, { useState } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { Text } from './Text';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DatePickerModal } from './DatePickerModal';
import { Colors, Radius, TextStyles } from '../../constants';

interface Props {
  value: string;
  onChange: (value: string) => void;
  style?: object;
}

export function DatePickerField({ value, onChange, style }: Props) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <Pressable 
        style={[styles.inputContainer, style]} 
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.inputText, !value && styles.placeholderText]}>
          {value || 'YYYY-MM-DD'}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={Colors.text.secondary} />
      </Pressable>
      
      <DatePickerModal 
        isVisible={modalVisible}
        value={value}
        onClose={() => setModalVisible(false)}
        onChange={onChange}
      />
    </>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputText: {
    ...TextStyles.labelLg,
    color: Colors.text.primary,
  },
  placeholderText: {
    color: Colors.text.muted,
  },
});
