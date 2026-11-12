# AI Travel Quest 旅行軟木板（llm wiki 版）

從一個景點出發，慢慢貼成一趟旅行。

跟 AI 說你看到的景點，AI 會寫好計畫檔，網站會列出附近值得去的地方、附上推薦理由，並由程式查座標、算距離。純靜態網頁，沒有後端，不收任何金鑰。

> 這是「用 `CLAUDE.md` 讓 AI 照同一套規則持續擴充內容」的作業專案。目前只做第一階段：行程規劃。

## AI 與程式的分工

| AI 負責寫 | 程式負責算與驗證 |
| --- | --- |
| 簡介、路線、停留時間、小提醒、附近景點的名稱與推薦理由 | 座標、距離、資訊連結、「已驗證」標籤、格式檢查 |

AI 不會給價格、營業時間、門票、經緯度或網址；這些由程式或參數表產生，不知道的就標「待確認」。新增計畫的規則見 [CLAUDE.md](CLAUDE.md)。

## 在自己的電腦上看

需要 Python（預覽用）。在專案資料夾執行：

```bash
python -m http.server 8000
```

然後開 <http://localhost:8000/>。不能直接雙擊 HTML，瀏覽器會擋住資料讀取。

## 新增一個計畫

用 Claude Code 開啟這個資料夾，直接說：

```
新增一個計畫：伏見稻荷
```

AI 會讀 `CLAUDE.md`，依固定格式建立 `data/plans/<id>.json`、更新清單並驗收。

## 驗收（需要 Node.js）

```bash
npm run check
```

檢查所有計畫的格式、檔名與 id 是否一致、`index.json` 是否漏登記。沒有安裝任何 npm 套件。

## 資料夾

```
index.html        首頁（計畫卡片）
plan.html         計畫頁（plan.html?id=<id>）
assets/           樣式與 JavaScript
data/             計畫 JSON、地區與旅費參數表、問卷
scripts/          驗收腳本
CLAUDE.md         給 AI 讀的規則：新增旅遊計畫單元
```

## 目前的限制
- 景點驗證使用 OpenStreetMap Nominatim 的公用服務，每秒最多查一次，驗證約需 5 秒；網路異常時會標「未驗證」。
