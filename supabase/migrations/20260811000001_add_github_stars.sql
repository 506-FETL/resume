-- 20260811000001_add_github_stars.sql
-- GitHub star 计数的服务端缓存（全局共享一行 / 每仓库一行，公开只读）。
--   public.github_stars   缓存表：repo 主键、stars、fetched_at
-- 两个 SECURITY DEFINER 函数：
--   get_github_stars(owner, repo)        懒刷新读取：超 1 天则服务端 fetch GitHub 并回写，否则直接返回缓存
--   set_github_stars(owner, repo, stars) 兜底回写：当实例未启用 pgsql-http 时，前端 fetch 后调用它写回共享表
-- 设计意图：把原先「每客户端各自 fetch + localStorage」改为「全局一份、每天最多刷新一次」。
-- 主路径依赖 pgsql-http 扩展；若该扩展在实例上不可用，get_ 会静默降级返回缓存（可能为 0），
-- 由前端走 set_ 兜底路径补齐，保证功能不因扩展缺失而中断。

-- ============ 扩展：pgsql-http（主路径所需；不可用则由前端兜底） ============
-- 单独事务式尝试启用；失败不阻断后续对象创建。
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgsql-http 扩展不可用，get_github_stars 将降级为只读缓存，改由前端 set_github_stars 兜底刷新';
END;
$$;

-- ============ 表：github_stars ============
CREATE TABLE IF NOT EXISTS public.github_stars (
  repo text PRIMARY KEY,            -- 形如 'owner/name'，全小写归一
  stars int NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.github_stars ENABLE ROW LEVEL SECURITY;

-- 公开只读（GitHub star 数是公开信息，登录/未登录都可读）；不提供任何直接写策略，
-- 写入只经 SECURITY DEFINER 函数完成。
DROP POLICY IF EXISTS "github_stars_select_public" ON public.github_stars;
CREATE POLICY "github_stars_select_public" ON public.github_stars
  FOR SELECT USING (true);

-- ============ 函数：get_github_stars(p_owner, p_repo) （前端读取 + 懒刷新） ============
CREATE OR REPLACE FUNCTION public.get_github_stars(p_owner text, p_repo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_repo text := lower(p_owner || '/' || p_repo);
  v_row public.github_stars;
  v_stars int;
  v_body text;
BEGIN
  IF p_owner IS NULL OR p_repo IS NULL THEN
    RAISE EXCEPTION 'p_owner and p_repo required';
  END IF;

  SELECT * INTO v_row FROM public.github_stars WHERE repo = v_repo;

  -- 命中且未过期（<= 1 天）：直接返回缓存
  IF FOUND AND v_row.fetched_at > now() - interval '1 day' THEN
    RETURN jsonb_build_object(
      'repo', v_row.repo,
      'stars', v_row.stars,
      'fetched_at', v_row.fetched_at,
      'stale', false
    );
  END IF;

  -- 过期或未命中：尝试服务端拉取 GitHub 并回写。
  -- http 扩展不可用 / 网络失败 / 解析失败均进入 EXCEPTION，降级返回缓存（或标记需兜底）。
  BEGIN
    SELECT (content::jsonb ->> 'stargazers_count')::int
      INTO v_stars
      FROM extensions.http((
        'GET',
        'https://api.github.com/repos/' || p_owner || '/' || p_repo,
        ARRAY[extensions.http_header('User-Agent', 'gresume-app')],
        NULL,
        NULL
      )::extensions.http_request);

    IF v_stars IS NULL THEN
      RAISE EXCEPTION 'stargazers_count missing';
    END IF;

    INSERT INTO public.github_stars (repo, stars, fetched_at)
    VALUES (v_repo, v_stars, now())
    ON CONFLICT (repo) DO UPDATE
      SET stars = EXCLUDED.stars, fetched_at = EXCLUDED.fetched_at;

    RETURN jsonb_build_object(
      'repo', v_repo,
      'stars', v_stars,
      'fetched_at', now(),
      'stale', false
    );
  EXCEPTION WHEN OTHERS THEN
    -- 拉取失败：有缓存返回缓存并标记 stale=true（提示前端可走兜底刷新），无缓存返回 0
    RETURN jsonb_build_object(
      'repo', v_repo,
      'stars', COALESCE(v_row.stars, 0),
      'fetched_at', v_row.fetched_at,
      'stale', true
    );
  END;
END;
$$;

-- ============ 函数：set_github_stars(p_owner, p_repo, p_stars) （前端兜底回写） ============
-- 仅当客户端拿到比缓存更新的数据时回写：无行、或已过期、或值不同才更新，避免频繁写。
CREATE OR REPLACE FUNCTION public.set_github_stars(p_owner text, p_repo text, p_stars int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_repo text := lower(p_owner || '/' || p_repo);
  v_row public.github_stars;
BEGIN
  IF p_owner IS NULL OR p_repo IS NULL OR p_stars IS NULL THEN
    RAISE EXCEPTION 'p_owner, p_repo and p_stars required';
  END IF;
  IF p_stars < 0 THEN
    RAISE EXCEPTION 'p_stars must be >= 0';
  END IF;

  SELECT * INTO v_row FROM public.github_stars WHERE repo = v_repo;

  -- 有效缓存内（<= 1 天）不覆盖，防止个别客户端拿到旧值把新缓存冲掉
  IF FOUND AND v_row.fetched_at > now() - interval '1 day' THEN
    RETURN jsonb_build_object('repo', v_row.repo, 'stars', v_row.stars, 'fetched_at', v_row.fetched_at);
  END IF;

  INSERT INTO public.github_stars (repo, stars, fetched_at)
  VALUES (v_repo, p_stars, now())
  ON CONFLICT (repo) DO UPDATE
    SET stars = EXCLUDED.stars, fetched_at = EXCLUDED.fetched_at
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('repo', v_row.repo, 'stars', v_row.stars, 'fetched_at', v_row.fetched_at);
END;
$$;

-- ============ 授权：公开可读计数，anon + authenticated 均可执行 ============
REVOKE ALL ON FUNCTION public.get_github_stars(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_github_stars(text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.set_github_stars(text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_github_stars(text, text, int) TO anon, authenticated;
