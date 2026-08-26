# 前端源码

前端源码位于 [`frontend/`](frontend/)，最初导入自
[`HBAI-Ltd/Toonflow-web`](https://github.com/HBAI-Ltd/Toonflow-web)，基线提交为
`9c4cb0ec7d4f6b4067c7768e2df8cdc7f8587214`。

## 本地开发

分别启动后端和前端：

```powershell
# 终端 1：后端（http://localhost:10588）
yarn dev

# 终端 2：前端（http://localhost:50188）
cd frontend
yarn install --frozen-lockfile
yarn dev
```

## 更新内置前端

```powershell
cd frontend
yarn build-only
Copy-Item dist/index.html ../data/web/index.html -Force
```

`frontend/node_modules` 和 `frontend/dist` 是本地产物，不纳入版本控制。
