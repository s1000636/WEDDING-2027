# 我們的婚禮｜正式版網站檔案

此版本使用既有 Supabase 專案，僅包含 **6 個頁面**：首頁、待辦事項、賓客與桌次、廠商管理、婚禮流程、禮金管理。喜餅與家庭分工可用待辦事項管理；沒有獨立預算頁面。廠商管理有 21 種常見項目，可自行新增、編輯、刪除；總花費、已付款與尾款自動計算。

## 安裝與發布（GitHub Pages）

1. 建立**新的** GitHub public repository，例如 `WEDDING-2027`，不要使用既有 `WEDDING` repo。
2. 把本資料夾的 `index.html`、`style.css`、`app.js` 放在新 repo 的根目錄。請勿把整個資料夾再套一層。
3. GitHub repo → Settings → Pages → Deploy from a branch → main / (root) → Save。等候部署，新網站通常是 `https://你的帳號.github.io/WEDDING-2027/`。
4. Supabase → Authentication → URL Configuration：Site URL 設為新網站網址；Redirect URLs 加入同一網址（含結尾 `/`）。**不要使用舊 WEDDING 網址**。
5. Supabase → Authentication → Users：新人已受邀的帳號可以使用「忘記密碼／設定密碼」寄送密碼信。若邀請信尚未接受，可在網址設定完成後重新邀請。
6. 依下方 SQL 將兩位新人加入 `wedding_members`。確認登入後才能看到雲端資料。

## 授權新人（在 Supabase SQL Editor 執行）

請用真實 Email 替換下列範例，**只在 Supabase SQL Editor 執行**，不要把 Email 或此 SQL 放進公開 GitHub repo。

```sql
insert into public.wedding_members(user_id,role)
select id,'groom' from auth.users where lower(email)=lower('新郎@example.com')
on conflict (user_id) do update set role=excluded.role;

insert into public.wedding_members(user_id,role)
select id,'bride' from auth.users where lower(email)=lower('新娘@example.com')
on conflict (user_id) do update set role=excluded.role;

select u.email,m.role from public.wedding_members m
join auth.users u on u.id=m.user_id;
```

## 資料庫與安全

本網站使用先前已成功執行的 `schema.sql` 資料表名稱和欄位：`wedding_members`, `wedding_tasks`, `wedding_guests`, `wedding_vendors`, `wedding_schedule`, `wedding_gifts`。**不用重新執行舊 SQL**。若先前已有同名資料表、不同欄位或其他 RLS policy，應先核對再上線。

`sb_publishable_` 是允許放在公開網站的金鑰，但安全性依賴資料庫的 RLS。確認 `anon` 無法讀取上述表，`authenticated` 只能由 `wedding_members` 成員操作。僅隱藏畫面並不能保護資料。

目前**不提供父母唯讀連結**，因為尚未建立可撤銷權杖的安全後端；不要把新人帳號分享給父母。正式版尚未實際部署、也尚未在你的 Supabase 上做端對端測試。使用前請先用測試資料確認新增、編輯、刪除與權限正確。

## 使用說明

- 廠商管理 →「加入常見婚禮項目」會補入缺少的 21 個預設項目，不覆蓋既有資料。
- 「已付訂金／已付款」是目前累積付款額，尾款 = 總花費 - 已付金額。
- 賓客的桌號填數字；桌次總覽會自動依桌號分組。
- 本版本需連線才能使用，不提供未登入的假資料模式。
- 如需下載資料備份，可在 Supabase Table Editor 匯出 CSV。後續可加入 App 內匯出按鈕。
