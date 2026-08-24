# Code Quality Review Command

このブランチのプルリクエストをコード品質の観点で詳細にレビューします。

## コード品質レビュー観点

### 1. マジックナンバー・マジックストリング
- **数値の定数化**: 意味のある数値が定数化されているか
  ```typescript
  // ❌ Bad
  if (users.length > 100) { }

  // ✅ Good
  const MAX_USERS = 100
  if (users.length > MAX_USERS) { }
  ```
- **文字列の定数化**: 繰り返し使用される文字列が定数化されているか
  ```typescript
  // ❌ Bad
  localStorage.getItem('user-token')
  localStorage.setItem('user-token', token)

  // ✅ Good
  const STORAGE_KEYS = { USER_TOKEN: 'user-token' } as const
  localStorage.getItem(STORAGE_KEYS.USER_TOKEN)
  ```

### 2. 型安全性
- **any/unknown**: `any`の使用を避け、必要なら`unknown`を使用しているか
- **型アサーション**: `as`の使用が最小限に抑えられているか
- **オプショナル引数**: 引数がオプショナルになりすぎていないか
- **型ガード**: 適切な型ガードが使用されているか
- **null/undefined**: 適切にnull/undefinedを扱っているか
- **tRPC型推論**: `inferRouterOutputs`、`inferProcedureOutput`等でtRPCの型を適切に再利用しているか
- **Zodスキーマ**: バリデーションスキーマが適切に定義され、型推論が活用されているか

### 3. イミュータビリティ
- **const使用**: `let`や`var`ではなく`const`を使用しているか
- **配列操作**: `push`の代わりにスプレッド演算子や`concat`を使用しているか
  ```typescript
  // ❌ Bad
  const arr = []
  arr.push(item)

  // ✅ Good
  const arr = [...existingArr, item]
  ```
- **オブジェクト操作**: ミューテーションを避けているか
  ```typescript
  // ❌ Bad
  obj.name = 'new name'

  // ✅ Good
  const newObj = { ...obj, name: 'new name' }
  ```

### 4. 関数の設計
- **アロー関数**: `function` 宣言ではなくアロー関数を基本としているか（コンポーネント・フック・ユーティリティ・コールバックすべて統一）
  ```typescript
  // ❌ Bad
  function formatDate(date: Date) {
    return dayjs(date).format('YYYY/MM/DD')
  }
  const MyComponent = function() {
    return <div />
  }

  // ✅ Good
  const formatDate = (date: Date) => dayjs(date).format('YYYY/MM/DD')
  const MyComponent = () => <div />
  ```
- **単一責任**: 関数が1つの責任のみを持っているか
- **関数の長さ**: 関数が50行以内に収まっているか
- **引数の数**: 引数が3つ以内に収まっているか（多い場合はオブジェクトで渡す）
- **早期リターン**: ネストを減らすために早期リターンを使用しているか
- **三項演算子のネスト禁止**: 三項演算子がネストする場合は独自関数に切り出し、if文で早期returnしているか
  ```typescript
  // ❌ Bad - 三項演算子のネスト
  const label = isAdmin ? 'Admin' : isMember ? 'Member' : 'Guest'

  // ✅ Good - 独自関数に切り出してif文でreturn
  const getLabel = (isAdmin: boolean, isMember: boolean): string => {
    if (isAdmin) return 'Admin'
    if (isMember) return 'Member'
    return 'Guest'
  }
  const label = getLabel(isAdmin, isMember)
  ```
- **純粋関数**: 副作用のない純粋関数として実装されているか

### 5. 命名規則
- **変数名**: 意図が明確な変数名になっているか
- **関数名**: 動詞で始まり、何をするかが明確か
- **真偽値**: `is`、`has`、`can`などのプレフィックスがついているか
- **定数**: UPPER_SNAKE_CASEになっているか
- **省略形**: 適切に省略されているか（過度な省略を避ける）

### 6. コメント
- **必要性**: 複雑なロジックに適切なコメントがあるか
- **不要なコメント**: 自明なコードにコメントがついていないか
- **TODOコメント**: 残されたTODOコメントがないか（あればIssue化）

### 7. エラーハンドリング
- **try-catch**: 適切にエラーハンドリングされているか
- **エラーメッセージ**: わかりやすいエラーメッセージになっているか
- **エラーログ**: 適切にエラーログが出力されているか
- **エラー伝播**: エラーが適切に上位に伝播されているか

### 8. DRY原則（Don't Repeat Yourself）
- **重複コード検出**: 同じようなコードが複数箇所にないか
  ```typescript
  // ❌ Bad - 重複したロジック
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const checkEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  
  // ✅ Good - 一つに統一
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ```
- **共通化**: 共通ロジックが関数やHooksとして抽出されているか
  ```typescript
  // ❌ Bad - ロジックの重複
  const UserCard = () => {
    const formattedDate = dayjs(user.createdAt).format('YYYY/MM/DD')
    return <div>{formattedDate}</div>
  }
  const PostCard = () => {
    const formattedDate = dayjs(post.createdAt).format('YYYY/MM/DD')
    return <div>{formattedDate}</div>
  }
  
  // ✅ Good - ユーティリティ関数として共通化
  const formatDate = (date: Date) => dayjs(date).format('YYYY/MM/DD')
  ```
- **重複した型定義**: 同じ型定義が複数ファイルに存在していないか（`types/`に集約）
- **重複したスタイル**: 同じCSSやChakraUIのpropsが複数箇所に存在していないか（テーマや`const/`に集約）
- **重複したバリデーション**: 同じバリデーションロジックが複数箇所に存在していないか（Zodスキーマの再利用）
- **コピペコード**: わずかな違いで同じようなコードが繰り返されていないか
- **再利用性**: コンポーネントやユーティリティが再利用可能な形になっているか

### 9. ネストの深さ
- **3階層以内**: ネストが3階層以内に収まっているか
- **早期リターン**: 早期リターンでネストを減らせないか
- **関数抽出**: ネストの深い部分を関数として抽出できないか
- **三項演算子のネスト**: 三項演算子が2段以上ネストしている場合は独自関数に切り出しているか
  ```typescript
  // ❌ Bad
  const message = hasError ? 'エラー' : isLoading ? '読込中' : isEmpty ? '空です' : 'OK'

  // ✅ Good
  const getMessage = (hasError: boolean, isLoading: boolean, isEmpty: boolean): string => {
    if (hasError) return 'エラー'
    if (isLoading) return '読込中'
    if (isEmpty) return '空です'
    return 'OK'
  }
  ```

### 10. パフォーマンス
- **useMemo/useCallback**: 適切に使用されているか（過度な使用も避ける）
- **useEffect依存配列**: 適切な依存配列が設定されているか
- **リストのkey**: リストレンダリングで適切なkeyが設定されているか
- **無限ループ**: useEffectなどで無限ループが発生しないか
- **React Query設定**: `staleTime`、`gcTime`、`refetchOnWindowFocus`等が適切に設定されているか
- **N+1問題**: Prismaの`include`や`select`を適切に使用し、N+1問題を回避しているか
- **Server Components**: Next.js App Routerで適切にServer Componentsを活用しているか

### 11. テスタビリティ
- **依存性注入**: 外部依存がテストしやすい形になっているか
- **純粋関数**: ビジネスロジックが純粋関数として実装されているか
- **モック可能性**: 外部APIやDBアクセスがモック可能な形になっているか

### 12. ファイル構成
- **ファイルサイズ**: ファイルが300行以内に収まっているか
- **責務の分離**: 1ファイル1責務になっているか
- **ディレクトリ構造**: 適切なディレクトリ構造になっているか

## アンチパターン検出

以下のアンチパターンをチェック：

1. **God Object**: 1つのファイルに責務が集中しすぎている
2. **Long Method**: 50行を超える長い関数
3. **Long Parameter List**: 3つ以上の引数を持つ関数
4. **Duplicate Code**: 同じようなコードの繰り返し
5. **Large Class**: 300行を超える大きなファイル
6. **Feature Envy**: 他のオブジェクトのデータに頻繁にアクセスしている
7. **Primitive Obsession**: プリミティブ型に依存しすぎている
8. **Switch Statements**: 長いswitch文やif-else連鎖
9. **Lazy Class**: ほとんど何もしていないクラス/ファイル
10. **Dead Code**: 使用されていないコード

## 出力形式

```markdown
# コード品質レビュー結果

## 📊 品質メトリクス
- 平均関数長: [X]行
- 最大関数長: [X]行（ファイル名:関数名）
- 最大ファイルサイズ: [X]行（ファイル名）
- マジックナンバー検出数: [X]個
- any使用箇所: [X]箇所
- let/var使用箇所: [X]箇所

## 🔴 Critical（優先度:高）
[重大な品質問題]

## 🟡 Medium（優先度:中）
[中程度の品質問題]

## 🟢 Minor（優先度:低）
[軽微な品質問題]

## 🎯 アンチパターン検出
[検出されたアンチパターン]

## ✅ ベストプラクティス
[良かった点]

## 📝 改善提案
[全体的な改善提案]
```

それでは、このブランチのPRをコード品質の観点でレビューしてください。
