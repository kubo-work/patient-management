import { createTheme } from "@mantine/core";

export const theme = createTheme({
    fontFamily: `"Helvetica Neue", "Hiragino Sans",
    "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ Pro W3",
    "Hiragino Kaku Gothic Pro", "メイリオ", Meiryo, Osaka, "ＭＳ Ｐゴシック",
    "MS PGothic", sans-serif`,
    primaryColor: 'brand',
    colors: {
        brand: [
            '#F6A94B', '#F5A03F', '#F59B2D', '#F39111', '#D87A0E', '#B5640B',
            '#9E4F09', '#8A4407', '#733608',
        ],
    },
});
