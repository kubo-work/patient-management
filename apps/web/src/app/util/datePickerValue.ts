import dayjs from "dayjs";

// Mantine 8 以降の @mantine/dates は、onChange に Date ではなく
// "YYYY-MM-DD" や "YYYY-MM-DD HH:mm:ss" の文字列を渡す。
// フォームと API は Date で扱うため、ここで変換する。
// dayjs はこの形式をローカル時刻として解釈する（new Date("YYYY-MM-DD") は UTC の 0 時になる）。
export const toDateFromPickerValue = (pickerValue: string): Date => dayjs(pickerValue).toDate();
