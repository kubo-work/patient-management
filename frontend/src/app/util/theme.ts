import { createTheme } from "@mantine/core";

export const theme = createTheme({
    fontFamily: 'sans-serif',
    primaryColor: 'orange',
    colors: {
        orange: [
            '#fff4e6', '#ffe8cc', '#ffd8a8', '#ffc078', '#ffa94d', '#ff922b',
            '#fd7e14', '#f76707', '#e8590c', '#d9480f',
        ],
    },
    // text: {
    //     color: 'var(--mantine-color-orange-6)', // 全体のデフォルトフォントカラー
    // },
});
