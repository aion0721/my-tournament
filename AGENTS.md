# AGENTS.md

## 🚨 MUST RULES（最重要）

- 文字列は UTF-8 の通常文字で記述すること（\uXXXX 禁止）
- 文字化けした状態で編集しないこと（先に修正する）
- shellでファイルを扱う場合は Encoding を明示すること(utf-8)
- 全置換は禁止し、必ず最小差分で変更すること

## 文字コード

- テキストファイルは `UTF-8` で統一する
- 新規作成・編集時は `UTF-8` で保存し、`Shift-JIS` や環境依存のコードページを使わない
- Windows 環境ではターミナルやスクリプトの既定エンコーディングで文字化けしやすいため、ファイル読み書き時は文字コードを明示して `UTF-8` を優先する
- 既存ファイルの文字コードが不明な場合は、内容確認なしに保存し直さず、現在のエンコーディングを確認してから扱う

## ファイルの読み取り書き込みについて

- 適用範囲: このファイルが置かれたフォルダ配下すべて。
- 文字コードは UTF-8 を必須とする。
- 日本語を `\uXXXX` 形式で出力しないこと。
- 文字化けした内容を見つけた場合、そのまま編集せず UTF-8 の正しい文字列として扱うこと。

### shell 利用ルール

- shell を使わずに済む場合は、エディタ上のファイル内容を優先して扱うこと。
- PowerShell でファイルを読む場合は、必ず Encoding を明示すること。
  - 例: `Get-Content -Raw -Encoding utf8 <FILE>`

- PowerShell でファイルを書く場合は、必ず UTF-8 を明示すること。
  - 例: `Set-Content -Encoding utf8`
  - 例: `Add-Content -Encoding utf8`
  - 例: `Out-File -Encoding utf8`

### PowerShell 5.1 実行ラッパ

- PowerShell 5.1 で日本語を含むコマンドを実行する場合は、以下のラッパを付けること。
- 形式（`<COMMAND>` を実コマンドに置換）:
  - `[Console]::InputEncoding=[Text.UTF8Encoding]::new($false); [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $OutputEncoding=[Text.UTF8Encoding]::new($false); chcp 65001 > $null; & { <COMMAND> }`
