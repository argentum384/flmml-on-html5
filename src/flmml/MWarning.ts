module flmml {
    export class MWarning {
        static UNKNOWN_COMMAND: number = 0;
        static UNCLOSED_REPEAT: number = 1;
        static UNOPENED_COMMENT: number = 2;
        static UNCLOSED_COMMENT: number = 3;
        static RECURSIVE_MACRO: number = 4;
        static UNCLOSED_ARGQUOTE: number = 5;
        static UNCLOSED_GROUPNOTES: number = 6;
        static UNOPENED_GROUPNOTES: number = 7;
        static INVALID_MACRO_NAME: number = 8;
        static s_string: Array<string> = [
            "対応していないコマンド '%s' があります。",
            "終わりが見つからない繰り返しがあります。",
            "始まりが見つからないコメントがあります。",
            "終わりが見つからないコメントがあります。",
            "マクロが再帰的に呼び出されています。",
            "マクロ引数指定の \"\" が閉じられていません",
            "終りが見つからない連符があります",
            "始まりが見つからない連符があります",
            "マクロ名に使用できない文字が含まれています。'%s'"
        ];

        static getString(warnId: number, str: string): string {
            return this.s_string[warnId].replace("%s", str);
        }
    }
}
