import { createTheme } from "@mantine/core";

export const theme = createTheme({
    fontFamily: `"Helvetica Neue", "Hiragino Sans",
    "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ Pro W3",
    "Hiragino Kaku Gothic Pro", "メイリオ", Meiryo, Osaka, "ＭＳ Ｐゴシック",
    "MS PGothic", sans-serif`,
    primaryColor: 'brand',
    colors: {
        brand: [
            '#8d4a00', '#F5A03F', '#c07d00', '#da9600', '#f3b000', '#ffca1a',
            '#ffe333', '#fffc4d', '#ffff66',
        ],
    },
});
