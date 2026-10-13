---
title: "GaussDB 管理脚本"
description: "#!/bin/bash print_header() { echo \"==============================\" echo \" GaussDB 管理脚本\" echo \"==============================\" } configure_environment() { # Open"
pubDatetime: 2026-03-06T13:18:00Z
tags: []
draft: false
---

```text
#!/bin/bash

print_header() {
    echo "=============================="
    echo "      GaussDB 管理脚本"
    echo "=============================="
}

configure_environment() {
    # OpenGauss 客户端与库路径（优先使用环境变量）
    GSQL_BIN="${GSQL_BIN:-$(command -v gsql)}"
    GSDUMP_BIN="${GSDUMP_BIN:-$(command -v gs_dump)}"

    if [ -n "${GAUSS_LIB_PATH:-}" ]; then
        export LD_LIBRARY_PATH="$GAUSS_LIB_PATH:${LD_LIBRARY_PATH:-}"
    fi
}

validate_client_tools() {
    if [ -z "$GSQL_BIN" ] || [ ! -x "$GSQL_BIN" ]; then
        echo "❌ 未找到 gsql，请设置环境变量 GSQL_BIN 或将 gsql 加入 PATH"
        exit 1
    fi

    if [ -z "$GSDUMP_BIN" ] || [ ! -x "$GSDUMP_BIN" ]; then
        echo "❌ 未找到 gs_dump，请设置环境变量 GSDUMP_BIN 或将 gs_dump 加入 PATH"
        exit 1
    fi
}

cleanup() {
    unset PGPASSWORD
}

read_connection_info() {
    read -p "请输入数据库主机 (默认: localhost): " DB_HOST
    DB_HOST=${DB_HOST:-localhost}

    read -p "请输入数据库端口 (默认: 5432): " DB_PORT
    DB_PORT=${DB_PORT:-5432}

    read -p "请输入管理员用户名 (默认: omm): " DB_USER
    DB_USER=${DB_USER:-omm}

    read -s -p "请输入数据库登录密码: " DB_PASS
    echo

    export PGPASSWORD="$DB_PASS"
    trap cleanup EXIT
}

run_gsql() {
    local db="${1:-postgres}"
    shift
    "$GSQL_BIN" -v -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -W "$DB_PASS" -d "$db" "$@"
}

test_connection() {
    echo "正在测试数据库连接..."

    if run_gsql postgres -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ 数据库连接成功"
        echo
        return 0
    fi

    echo "❌ 数据库连接失败，请检查用户名或密码"
    exit 1
}

show_menu() {
    echo "请选择操作:"
    echo "1. 创建数据库"
    echo "2. 创建用户并授权"
    echo "3. 导出数据库"
    echo "4. 执行 SQL 文件"
    echo "5. 查看数据库列表"
    echo "6. 查看用户列表"
    echo "7. 退出"
}

create_database() {
    local new_db

    read -p "请输入要创建的数据库名: " new_db

    if run_gsql postgres -c "CREATE DATABASE \"$new_db\" ENCODING 'UTF8';"; then
        echo "✅ 数据库 [$new_db] 创建完成"
    else
        echo "❌ 数据库创建失败"
    fi
}

create_user_and_grant() {
    local new_user new_user_pass auth_db

    read -p "请输入新用户名: " new_user
    read -s -p "请输入新用户密码: " new_user_pass
    echo
    read -p "请输入授权数据库名: " auth_db

    if run_gsql postgres <<EOF
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '$new_user') THEN
      CREATE ROLE "$new_user" LOGIN PASSWORD '$new_user_pass';
      RAISE NOTICE '用户 $new_user 创建成功';
   ELSE
      RAISE NOTICE '用户 $new_user 已存在，跳过创建';
   END IF;
END
\$\$;

GRANT ALL PRIVILEGES ON DATABASE "$auth_db" TO "$new_user";
EOF
    then
        echo "✅ 用户 [$new_user] 创建并授权数据库 [$auth_db] 完成"
    else
        echo "❌ 用户创建或授权失败"
    fi
}

export_database() {
    local export_db export_file default_export_file

    read -p "请输入要导出的数据库名: " export_db
    default_export_file="${export_db}_$(date +%Y%m%d%H%M%S).sql"
    read -p "请输入导出文件名 (默认: ${default_export_file}): " export_file
    export_file=${export_file:-$default_export_file}

    echo "正在导出数据库 [$export_db]..."

    if "$GSDUMP_BIN" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -W "$DB_PASS" -F p -f "$export_file" "$export_db"; then
        echo "✅ 数据库导出成功: $export_file"
        echo "📦 文件大小: $(du -sh "$export_file" | cut -f1)"
    else
        echo "❌ 导出失败"
    fi
}

execute_sql_file() {
    local target_db sql_file

    read -p "请输入目标数据库名: " target_db
    read -p "请输入 SQL 文件路径: " sql_file

    if [ ! -f "$sql_file" ]; then
        echo "❌ 文件不存在: $sql_file"
        return 10
    fi

    echo "正在执行 SQL 文件: $sql_file ..."

    if run_gsql "$target_db" -f "$sql_file"; then
        echo "✅ SQL 文件执行完成"
    else
        echo "❌ SQL 执行失败"
    fi
}

list_databases() {
    echo "====== 数据库列表 ======"
    run_gsql postgres -c "\l"
}

list_users() {
    echo "====== 用户列表 ======"
    run_gsql postgres -c "\du"
}

handle_choice() {
    local choice="$1"

    case "$choice" in
        1)
            create_database
            ;;
        2)
            create_user_and_grant
            ;;
        3)
            export_database
            ;;
        4)
            execute_sql_file
            ;;
        5)
            list_databases
            ;;
        6)
            list_users
            ;;
        7)
            echo "退出脚本"
            exit 0
            ;;
        *)
            echo "⚠️  无效选项，请重新输入"
            ;;
    esac
}

main() {
    local choice rc

    print_header
    configure_environment
    validate_client_tools
    read_connection_info
    test_connection

    while true; do
        show_menu
        read -p "请输入选项 [1-7]: " choice

        handle_choice "$choice"
        rc=$?

        if [ "$rc" -eq 10 ]; then
            continue
        fi

        echo
    done
}

main "$@"

```

mysql

```text
#!/bin/bash

print_header() {
    echo "=============================="
    echo "      MySQL 管理脚本"
    echo "=============================="
}

configure_environment() {
    # 自动加入 MySQL 路径
    export PATH="/usr/local/mysql/bin:$PATH"

    MYSQL_BIN="${MYSQL_BIN:-$(command -v mysql)}"
    MYSQLDUMP_BIN="${MYSQLDUMP_BIN:-$(command -v mysqldump)}"
}

validate_client_tools() {
    if [ -z "$MYSQL_BIN" ] || [ ! -x "$MYSQL_BIN" ]; then
        echo "❌ 未找到 mysql"
        exit 1
    fi

    if [ -z "$MYSQLDUMP_BIN" ] || [ ! -x "$MYSQLDUMP_BIN" ]; then
        echo "❌ 未找到 mysqldump"
        exit 1
    fi
}

cleanup() {
    unset MYSQL_PWD
}

read_connection_info() {
    read -p "请输入数据库主机 (默认: localhost): " DB_HOST
    DB_HOST=${DB_HOST:-localhost}

    read -p "请输入数据库端口 (默认: 3306): " DB_PORT
    DB_PORT=${DB_PORT:-3306}

    read -p "请输入管理员用户名 (默认: root): " DB_USER
    DB_USER=${DB_USER:-root}

    read -s -p "请输入数据库登录密码: " DB_PASS
    echo

    export MYSQL_PWD="$DB_PASS"
    trap cleanup EXIT
}

run_mysql() {
    local db="$1"
    shift

    if [ -n "$db" ]; then
        "$MYSQL_BIN" -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$db" "$@"
    else
        "$MYSQL_BIN" -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$@"
    fi
}

test_connection() {
    echo "正在测试数据库连接..."

    if run_mysql "" -e "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ 数据库连接成功"
        echo
        return 0
    fi

    echo "❌ 数据库连接失败"
    exit 1
}

show_menu() {
    echo "请选择操作:"
    echo "1. 创建数据库"
    echo "2. 创建用户并授权"
    echo "3. 导出数据库"
    echo "4. 执行 SQL 文件"
    echo "5. 查看数据库列表"
    echo "6. 查看用户列表"
    echo "7. 退出"
}

# 简单安全校验
is_safe_name() {
    [[ "$1" =~ ^[A-Za-z0-9_]+$ ]]
}

create_database() {
    local new_db

    read -p "请输入要创建的数据库名: " new_db

    if ! is_safe_name "$new_db"; then
        echo "❌ 数据库名不合法"
        return
    fi

    if run_mysql "" -e "CREATE DATABASE \`$new_db\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"; then
        echo "✅ 数据库 [$new_db] 创建完成"
    else
        echo "❌ 数据库创建失败"
    fi
}

create_user_and_grant() {
    local new_user new_user_pass auth_db

    read -p "请输入新用户名: " new_user
    read -s -p "请输入新用户密码: " new_user_pass
    echo
    read -p "请输入授权数据库名: " auth_db

    if ! is_safe_name "$new_user" || ! is_safe_name "$auth_db"; then
        echo "❌ 用户名或数据库名不合法"
        return
    fi

    if run_mysql "" <<EOF
CREATE USER IF NOT EXISTS '$new_user'@'%' IDENTIFIED BY '$new_user_pass';
GRANT ALL PRIVILEGES ON \`$auth_db\`.* TO '$new_user'@'%';
FLUSH PRIVILEGES;
EOF
    then
        echo "✅ 用户 [$new_user] 创建并授权 [$auth_db] 完成"
    else
        echo "❌ 操作失败"
    fi
}

export_database() {
    local export_db export_file default_export_file

    read -p "请输入要导出的数据库名: " export_db

    if ! is_safe_name "$export_db"; then
        echo "❌ 数据库名不合法"
        return
    fi

    default_export_file="${export_db}_$(date +%Y%m%d%H%M%S).sql"
    read -p "请输入导出文件名 (默认: ${default_export_file}): " export_file
    export_file=${export_file:-$default_export_file}

    echo "正在导出数据库 [$export_db]..."

    if "$MYSQLDUMP_BIN" -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$export_db" > "$export_file"; then
        echo "✅ 导出成功: $export_file"
        echo "📦 大小: $(du -sh "$export_file" | cut -f1)"
    else
        echo "❌ 导出失败"
    fi
}

execute_sql_file() {
    local target_db sql_file

    read -p "请输入目标数据库名: " target_db
    read -p "请输入 SQL 文件路径: " sql_file

    if [ ! -f "$sql_file" ]; then
        echo "❌ 文件不存在"
        return 10
    fi

    echo "正在执行 SQL..."

    if run_mysql "$target_db" < "$sql_file"; then
        echo "✅ 执行完成"
    else
        echo "❌ 执行失败"
    fi
}

list_databases() {
    echo "====== 数据库列表 ======"
    run_mysql "" -e "SHOW DATABASES;"
}

list_users() {
    echo "====== 用户列表 ======"
    run_mysql "" -e "SELECT user, host FROM mysql.user;"
}

handle_choice() {
    case "$1" in
        1) create_database ;;
        2) create_user_and_grant ;;
        3) export_database ;;
        4) execute_sql_file ;;
        5) list_databases ;;
        6) list_users ;;
        7) echo "退出"; exit 0 ;;
        *) echo "⚠️ 无效选项" ;;
    esac
}

main() {
    print_header
    configure_environment
    validate_client_tools
    read_connection_info
    test_connection

    while true; do
        show_menu
        read -p "请输入选项 [1-7]: " choice

        handle_choice "$choice"
        [ "$?" -eq 10 ] && continue

        echo
    done
}

main "$@"

```
