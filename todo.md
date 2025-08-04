# TODO

## ✅ 完了: ユーザーグループ追加エラーの修正（最終版）

**問題**: ユーザー `57040ad8-10a1-70e8-f855-b01fdbad334b` をグループ `user` に追加しようとすると「User not found」エラーが発生

**根本原因**: 
- 当初、CognitoのAPIがemailのみを受け付けると誤解していた
- **実際は**: CognitoのAPI（`AdminGetUserCommand`等）の`Username`パラメータは**sub（UUID）も直接受け付ける**
- DynamoDBの`user_id` = Cognitoの`sub`なので、複雑な変換は不要だった

**最終的な修正**:
🎯 **シンプルアプローチ**: user_id（UUID）をそのまま`Username`パラメータに渡す

**変更内容**:
1. **複雑なロジックを削除**:
   - `getUserEmailById()` 関数を削除
   - UUID判定・email変換ロジックを削除
   
2. **修正した関数**:
   - `addUserToGroup()`: `userIdOrEmail`をそのまま`Username`に使用
   - `removeUserFromGroup()`: 同様にシンプル化
   - `getCognitoGroups()`: 同様にシンプル化
   - `isUserAdministrator()`: 同様にシンプル化

3. **詳細ログ**:
   - 診断用のログは保持

**技術的根拠**:
- CognitoのAPI仕様: `Username`パラメータは以下を受け付ける
  - username属性
  - email（alias_attributesの場合）
  - **sub（UUID）** ← これが重要！
- DynamoDBの`user_id` = Cognitoの`sub`なので直接使用可能

**コードの改善**:
- 70行以上の複雑なロジックを削除
- よりシンプルで保守しやすいコード
- パフォーマンス向上（DynamoDB呼び出し不要）

**修正ファイル**:
- ✅ `server/utils/cognito-groups.ts` - 大幅簡略化
- ✅ 関連APIエンドポイントは変更不要
