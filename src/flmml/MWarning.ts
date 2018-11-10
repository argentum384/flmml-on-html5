module flmml {
    export class MWarning {
        static readonly UNKNOWN_COMMAND: number = 0;
        static readonly UNCLOSED_REPEAT: number = 1;
        static readonly UNOPENED_COMMENT: number = 2;
        static readonly UNCLOSED_COMMENT: number = 3;
        static readonly RECURSIVE_MACRO: number = 4;
        static readonly UNCLOSED_ARGQUOTE: number = 5;
        static readonly UNCLOSED_GROUPNOTES: number = 6;
        static readonly UNOPENED_GROUPNOTES: number = 7;
        static readonly INVALID_MACRO_NAME: number = 8;
        static readonly s_string: Array<string> = [
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
