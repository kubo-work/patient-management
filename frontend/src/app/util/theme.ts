import { createTheme } from "@mantine/core";

export const theme = createTheme({
    fontFamily: `"Helvetica Neue", "Hiragino Sans",
    "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ Pro W3",
    "Hiragino Kaku Gothic Pro", "メイリオ", Meiryo, Osaka, "ＭＳ Ｐゴシック",
    "MS PGothic", sans-serif`,
    primaryColor: 'brand',
    colors: {
        brand: [
            '#fce1a1', '#fbd18a', '#fbc074', '#fabf5d', '#f3b000',
            '#dc9e00', '#c68d00', '#af7b00', '#996a00',
        ],
    },
});
