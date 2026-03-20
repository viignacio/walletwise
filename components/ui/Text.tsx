import { Text as RNText, TextProps, StyleSheet } from 'react-native'
import { FontFamily } from '../../constants/typography'
import { Colors } from '../../constants/colors'

export function Text({ style, ...props }: TextProps) {
  return <RNText style={StyleSheet.flatten([styles.base, style])} {...props} />
}

const styles = StyleSheet.create({
  base: {
    fontFamily: FontFamily.regular,
    color: Colors.text.primary,
  },
})
