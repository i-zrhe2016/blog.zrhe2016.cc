# 评论审核后展示

## Ticket: comments-moderation-1

实现基于 Cloudflare D1 的评论提交、审核和公开展示。评论默认 `pending`，仅管理员批准后以 `approved` 状态返回文章页；后台支持查询、通过、拒绝和删除。

验收：公开 API 仅返回已批准评论；后台 API 受现有认证保护；文章页可提交并加载评论；D1 migration、文档和测试完成。
