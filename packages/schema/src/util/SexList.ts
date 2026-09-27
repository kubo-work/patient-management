// 性別の選択肢。API の zod 検証（キー）と画面の表示名（label）の両方がこれを参照する。
export const sexList = {
    no_answer: {
        label: "未回答"
    },
    man: {
        label: "男性"
    },
    woman: {
        label: "女性"
    },
    neither: {
        label: "その他"
    }
} as const;
