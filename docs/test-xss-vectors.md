# XSS 对抗性测试用例

以下是一些常见的 XSS 攻击向量，用于测试 HTML 清理函数的安全性：

## 测试用例 1: 基本 Script 标签
```html
<html>
<script>alert('XSS')</script>
</html>
```

## 测试用例 2: 大小写变体
```html
<html>
<SCRIPT>alert('XSS')</SCRIPT>
<ScRiPt>alert('XSS')</ScRiPt>
</html>
```

## 测试用例 3: 事件处理器 - onclick
```html
<html>
<div onclick="alert('XSS')">点击我</div>
<button onclick="alert('XSS')">按钮</button>
</html>
```

## 测试用例 4: 事件处理器 - onerror
```html
<html>
<img src="invalid.jpg" onerror="alert('xss')" />
</html>
```

## 测试用例 5: 事件处理器 - onload
```html
<html>
<body onload="alert('XSS')">内容</body>
<iframe onload="alert('XSS')"></iframe>
</html>
```

## 测试用例 6: javascript: URL - href
```html
<html>
<a href="javascript:alert('XSS')">链接</a>
</html>
```

## 测试用例 7: javascript: URL - src
```html
<html>
<img src="javascript:alert('XSS')" />
<iframe src="javascript:alert('XSS')"></iframe>
</html>
```

## 测试用例 8: 编码绕过 - HTML 实体
```html
<html>
<a href="&#106;avascript:alert('XSS')">链接</a>
<a href="&#x6A;avascript:alert('XSS')">链接</a>
</html>
```

## 测试用例 9: 空格分隔绕过
```html
<html>
<a href="j a v a s c r i p t:alert('XSS')">链接</a>
</html>
```

## 测试用例 10: 混合大小写和编码
```html
<html>
<a href="JaVaScRiPt:alert('XSS')">链接</a>
<a href="&#74;avascript:alert('XSS')">链接</a>
</html>
```

## 测试用例 11: data: URL - text/html
```html
<html>
<iframe src="data:text/html,<script>alert('XSS')</script>"></iframe>
</html>
```

## 测试用例 12: data: URL - text/javascript
```html
<html>
<script src="data:text/javascript,alert('XSS')"></script>
</html>
```

## 测试用例 13: style 中的 expression()
```html
<html>
<div style="background:expression(alert('XSS'))">内容</div>
<div style="width:expression(alert('XSS'))">内容</div>
</html>
```

## 测试用例 14: style 中的 javascript:
```html
<html>
<div style="background:javascript:alert('XSS')">内容</div>
</html>
```

## 测试用例 15: 危险标签 - iframe
```html
<html>
<iframe src="http://evil.com"></iframe>
</html>
```

## 测试用例 16: 危险标签 - object
```html
<html>
<object data="http://evil.com"></object>
</html>
```

## 测试用例 17: 危险标签 - embed
```html
<html>
<embed src="http://evil.com">
</html>
```

## 测试用例 18: 危险标签 - form
```html
<html>
<form action="http://evil.com" method="post">
  <input type="submit" value="提交">
</form>
</html>
```

## 测试用例 19: link 标签中的 javascript:
```html
<html>
<link href="javascript:alert('XSS')" rel="stylesheet">
</html>
```

## 测试用例 20: meta refresh 重定向
```html
<html>
<meta http-equiv="refresh" content="0;url=http://evil.com">
</html>
```

## 测试用例 21: 嵌套和组合攻击
```html
<html>
<div onclick="alert('XSS')" style="background:expression(alert('XSS'))">
  <a href="javascript:alert('XSS')">链接</a>
  <img src="invalid.jpg" onerror="alert('XSS')" />
</div>
</html>
```

## 测试用例 22: 事件处理器大小写变体
```html
<html>
<div OnClick="alert('XSS')">点击</div>
<div ONCLICK="alert('XSS')">点击</div>
<div OnClIcK="alert('XSS')">点击</div>
</html>
```

## 测试用例 23: 属性值中的引号绕过
```html
<html>
<div onclick='alert("XSS")'>点击</div>
<div onclick=alert('XSS')>点击</div>
</html>
```

## 测试用例 24: 多个事件处理器
```html
<html>
<div onclick="alert('XSS')" onmouseover="alert('XSS2')" onfocus="alert('XSS3')">内容</div>
</html>
```

## 测试用例 25: 合法的 HTML（应该保留）
```html
<html>
<div class="container">
  <h1>标题</h1>
  <p>这是一段正常的文本内容。</p>
  <a href="https://example.com">正常链接</a>
  <img src="https://example.com/image.jpg" alt="图片" />
  <div style="color: red; font-size: 16px;">样式文本</div>
</div>
</html>
```

## 测试用例 26: 混合合法和恶意内容
```html
<html>
<div class="normal">
  <p>正常内容</p>
  <script>alert('XSS')</script>
  <a href="https://example.com">正常链接</a>
  <a href="javascript:alert('XSS')">恶意链接</a>
</div>
</html>
```

