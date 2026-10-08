【美德少年成长积分榜｜素材替换版】

本包内容：
1. index.html           前台网站首页与各页面入口
2. admin.html           管理员录入积分的工具页
3. styles.css / app.js  前台样式与逻辑
4. data/                数据文件（孩子、活动、积分流水、相册、设置）
5. assets/              已替换好的视觉素材

一、上线方式（GitHub Pages）
把整个文件夹内容上传到你的仓库根目录，覆盖原来的同名文件即可。
然后等待 GitHub Pages 自动更新。

二、常用修改位置
1. 改活动报名链接、喔图直播链接：
   data/settings.json
2. 改总榜 / 活动榜积分：
   data/ledger.json
3. 改孩子名单：
   data/children.json
4. 改活动名称：
   data/activities.json
5. 改往期精彩相册：
   data/gallery.json

三、管理员工具页怎么用
打开：admin.html
1. 录入积分流水
2. 下载新的 ledger.json
3. 用下载的文件覆盖仓库里的 data/ledger.json
4. 网站会自动刷新榜单

四、说明
这版已经把你前面挑过的一批 PNG 素材换进网站框架里了。
如果后面你还想继续细修某一页（比如首页、总榜、活动榜、往期精彩），可以在这个基础上继续改。
