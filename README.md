# 1 + X 考试成绩批量查询系统

批量查询文件夹中的准考证成绩。

## 使用方式

```bash
npm install 1x-result-query
```

```ts
import { run } from "1x-result-query";

const zkzDir = "准考证目录";
run(zkzDir);
```
