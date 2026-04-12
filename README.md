<h1 align="center">🎓 Alt UU</h1>

Alt UU 是一款由 NOU 學生為同學打造的非官方手機 App。使用 Alt UU，就可以輕鬆在行動裝置上隨時隨地觀看 NOU UU 平台上的數位教材。   
此外，Alt UU 也整合了 [NOU 小幫手](https://nou-tools.binota.org/)，能讓你在 App 中輕鬆看到所有課程的視訊面授時間、學校行事曆、考古題等。

## 開發 / Development

本專案採用 NativePHP，後端使用 Laravel，前端使用 Vue.js 與 TailwindCSS。


## 開發 / Development

本專案採用 Laravel 框架開發，前端使用 Blade 與 TailwindCSS 搭配 Alpine.js 製作。  
若您有興趣參與貢獻，可 Clone 本專案後，依照以下步驟進行：

1. 請確保您的環境有 PHP 8.4 以上與 Node.js 22 以上。您可使用 [PHP.new](https://php.new/) 或 [Laravel Herd](https://herd.laravel.com)，快速建立 PHP 開發環境。此外，您的環境需要支援使用 `make` 指令。
2. 安裝相依套件：`composer install`
3. 執行 `composer run setup` —— 此指令會建立 `.env` 檔案、產生應用程式金鑰、執行資料庫遷移、安裝前端套件並打包前端資源。
4. 
4. 啟動開發伺服器：`composer run dev`，預設會在 `http://localhost:8000` 提供服務。

若您要將本專案編譯安裝至行動裝置，可使用本專案根目錄所包含的 [`MakeFile`](Makefile)。

開發時請遵守 [Code of Conduct](CODE_OF_CONDUCT.md) 中的行為準則，維持友善且包容的社群環境。

本專案含有測試，可執行 `php artisan test` 來確保功能正常。

本專案使用「[Conventional Commits](https://www.conventionalcommits.org/)」風格，範例：

```
feat(parser): support new exam schedule format
```

## 授權 / License

本專案採用 `AGPL-3.0-or-later` 開放原始碼授權，詳細內容請參閱 [LICENSE](LICENSE) 檔案。

> [!NOTE]  
> 由於我們採用 AGPL 授權，凡是使用到本專案程式碼的衍生作品也必須遵守相同的授權條款。換句話說，若您使用了本專案的程式碼，無論是修改還是直接使用，且包含通過網路提供服務，都必須將您的作品公開原始碼並採用 AGPL 授權。

