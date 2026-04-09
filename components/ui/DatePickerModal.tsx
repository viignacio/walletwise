import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Modal, useWindowDimensions } from 'react-native';
import { Text } from './Text';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius, Spacing, TextStyles, FontFamily } from '../../constants';

interface Props {
  isVisible: boolean;
  value: string; // YYYY-MM-DD
  onClose: () => void;
  onChange: (dateObj: string) => void;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DatePickerModal({ isVisible, value, onClose, onChange }: Props) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(value);

  useEffect(() => {
    if (isVisible) {
      setSelectedDate(value);
      if (value) {
        const [y, m, d] = value.split('-').map(Number);
        if (y && m && d) {
          setViewDate(new Date(y, m - 1, d));
        } else {
          setViewDate(new Date());
        }
      } else {
        setViewDate(new Date());
      }
    }
  }, [isVisible, value]);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const currentYear = viewDate.getFullYear();
  const currentMonthIndex = viewDate.getMonth();
  const monthName = viewDate.toLocaleString('default', { month: 'long' });

  // Calendar Math
  const firstDayOfMonth = new Date(currentYear, currentMonthIndex, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const emptyCells = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  const dayCells = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.min(windowWidth - Spacing[4] * 2, 360);
  const horizontalPadding = Spacing[4];
  const cellWidth = (cardWidth - horizontalPadding * 2) / 7;

  const handleSelectDay = (day: number) => {
    const formattedDate = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(formattedDate);
  };

  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  const handleApply = () => {
    onChange(selectedDate);
    onClose();
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.headerRow}>
            <View style={styles.monthSelector}>
              <Pressable style={styles.navBtn} onPress={handlePrevMonth}>
                <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
              </Pressable>
              <Text style={styles.monthLabel}>{monthName} {currentYear}</Text>
              <Pressable style={styles.navBtn} onPress={handleNextMonth}>
                <Ionicons name="chevron-forward" size={24} color={Colors.text.primary} />
              </Pressable>
            </View>
          </View>
          
          <View style={styles.daysRow}>
            {DAYS.map((day) => (
              <View key={day} style={styles.dayHeader}>
                <Text style={styles.dayHeaderText}>{day}</Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {emptyCells.map((val) => (
              <View key={`empty-${val}`} style={[styles.cell, { width: cellWidth, height: cellWidth }]} />
            ))}
            {dayCells.map((day) => {
              const dateStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = selectedDate === dateStr;
              const isToday = day === todayDate && currentMonthIndex === todayMonth && currentYear === todayYear;

              return (
                <Pressable
                  key={`day-${currentYear}-${currentMonthIndex}-${day}`}
                  onPress={() => handleSelectDay(day)}
                  style={[styles.cell, { width: cellWidth, height: cellWidth }]}
                >
                  <View style={[
                    styles.cellInner,
                    isToday && styles.todayCell,
                    isSelected && styles.selectedCell,
                  ]}>
                    <Text style={[
                      styles.cellText,
                      isToday && styles.todayCellText,
                      isSelected && styles.selectedCellText,
                    ]}>
                      {day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.footerBtn} onPress={onClose}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.footerBtn, styles.applyBtn]} onPress={handleApply}>
              <Text style={styles.applyLabel}>Apply</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing[4],
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    maxWidth: 360,
    width: '100%',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing[4],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing[2],
    marginTop: Spacing[4],
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing[4],
  },
  footerBtn: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.md,
  },
  applyBtn: {
    backgroundColor: Colors.primary,
  },
  cancelLabel: {
    ...TextStyles.label,
    color: Colors.text.muted,
  },
  applyLabel: {
    ...TextStyles.label,
    color: Colors.white,
    fontFamily: FontFamily.bold,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
  },
  navBtn: {
    padding: Spacing[2],
  },
  monthLabel: {
    ...TextStyles.h4,
    color: Colors.text.primary,
    minWidth: 140,
    textAlign: 'center',
  },
  daysRow: {
    flexDirection: 'row',
    marginBottom: Spacing[2],
  },
  dayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing[1],
  },
  dayHeaderText: {
    ...TextStyles.caption,
    fontFamily: FontFamily.medium,
    color: Colors.text.muted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellInner: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden', // Ensures background doesn't bleed past radius
  },
  selectedCell: {
    backgroundColor: Colors.primary,
  },
  todayCell: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.full,
  },
  cellText: {
    ...TextStyles.label,
    color: Colors.text.primary,
    lineHeight: undefined,
    includeFontPadding: false,
    textAlign: 'center',
  },
  selectedCellText: {
    color: Colors.white,
    fontFamily: FontFamily.bold,
  },
  todayCellText: {
    color: Colors.text.primary, // Ensure text is readable
    fontFamily: FontFamily.bold,
  },
});
