import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
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

  useEffect(() => {
    if (isVisible) {
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

  const handleSelectDay = (day: number) => {
    const formattedDate = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(formattedDate);
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
              <View key={`empty-${val}`} style={styles.cell} />
            ))}
            {dayCells.map((day) => {
              const dateStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = value === dateStr;
              
              const today = new Date();
              const isToday = 
                day === today.getDate() && 
                currentMonthIndex === today.getMonth() && 
                currentYear === today.getFullYear();

              return (
                <Pressable
                  key={`day-${day}`}
                  onPress={() => handleSelectDay(day)}
                  style={[
                    styles.cell,
                    styles.activeCell,
                    isSelected && styles.selectedCell,
                    !isSelected && isToday && styles.todayCell
                  ]}
                >
                  <Text style={[
                    styles.cellText,
                    isSelected && styles.selectedCellText,
                    !isSelected && isToday && styles.todayCellText
                  ]}>
                    {day}
                  </Text>
                </Pressable>
              );
            })}
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
    width: '100%',
    maxWidth: 360,
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
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  activeCell: {
    borderRadius: Radius.md,
  },
  selectedCell: {
    backgroundColor: Colors.primary,
  },
  todayCell: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cellText: {
    ...TextStyles.label,
    color: Colors.text.primary,
  },
  selectedCellText: {
    color: Colors.white,
    fontFamily: FontFamily.bold,
  },
  todayCellText: {
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
});
