1. **フロント改修** — `pages/profile.vue` で選択した画像ファイルを Base64 へ変換し、`{ filename, contentType, base64Data }` の JSON を `POST /api/upload/image` に送信するよう変更。生ファイルサイズの上限を 3MB に引き下げ、UI 表示・エラー文言も合わせて更新する。
2. **サーバーAPI改修** — `server/api/upload/image.post.ts` を Base64 受信仕様に書き換え、JSON からのデータ検証・Base64 デコード後の 3MB 制限、許可 MIME タイプの確認を行ってから S3 へ保存する。`createS3Client()` の利用やエラーハンドリングも調整する。
3. **ドキュメント更新** — `doc/specs/api_specification.md` など関連資料で、画像アップロードのリクエスト形式と容量上限を Base64 (最大3MB) に改訂する。

