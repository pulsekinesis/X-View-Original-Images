// ==UserScript==
// @name            twOpenOriginalImage
// @name:ja         Twitter 原寸びゅー
// @namespace       http://furyu.hatenablog.com/
// @author          furyu
// @license         MIT
// @version         0.1.17
// @include         http://twitter.com/*
// @include         https://twitter.com/*
// @include         https://mobile.twitter.com/*
// @include         https://pbs.twimg.com/media/*
// @include         https://tweetdeck.twitter.com/*
// @grant           GM_getValue
// @grant           GM_setValue
// @grant           GM_registerMenuCommand
// @grant           GM_xmlhttpRequest
// @grant           GM_download
// @require         https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.4/jszip.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/1.3.3/FileSaver.min.js
// @require         https://cdn.jsdelivr.net/gh/sizzlemctwizzle/GM_config@43fd0fe4de1166f343883511e53546e87840aeaf/gm_config.js
// @connect         twitter.com
// @connect         twimg.com
// @connect         furyutei.github.io
// @description     Open images in original size on Twitter.
// @description:ja  Web版Twitter・TweetDeckで、原寸画像の表示と保存が簡単にできるようになります。
// @homepageURL     https://github.com/pulsekinesis/X-View-Original-Images
// @supportURL     https://github.com/pulsekinesis/X-View-Original-Images/issues
// @contributionURL https://memo.furyutei.com/about#send_donation
// @compatible      chrome+tampermonkey
// @compatible      firefox+violentmonkey
// ==/UserScript==

/*
■ 関連記事など
  [Twitter 原寸びゅー：Twitterの原寸画像を開くGoogle Chrome拡張機能＆ユーザースクリプト公開 - 風柳メモ](http://furyu.hatenablog.com/entry/20160116/1452871567)
  [furyutei/twOpenOriginalImage](https://github.com/furyutei/twOpenOriginalImage)

■ 参考元
- [GoogleChrome拡張機能「twitter画像原寸ボタン」ver. 2.0公開 - hogashi.*](http://hogashi.hatenablog.com/entry/2016/01/01/234632)
  [hogashi/twitterOpenOriginalImage](https://github.com/hogashi/twitterOpenOriginalImage)
    The MIT License (MIT)
    Copyright (c) hogas [@hogextend](https://twitter.com/hogextend)
    [twitterOpenOriginalImage/LICENSE](https://github.com/hogashi/twitterOpenOriginalImage/blob/master/LICENSE)

■ 外部ライブラリ
- [JSZip](https://stuk.github.io/jszip/)
    Copyright (c) 2009-2014 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso
    The MIT License
    [jszip/LICENSE.markdown](https://github.com/Stuk/jszip/blob/master/LICENSE.markdown)

- [eligrey/FileSaver.js: An HTML5 saveAs() FileSaver implementation](https://github.com/eligrey/FileSaver.js/)
    Copyright © 2015 Eli Grey.
    The MIT License
    [FileSaver.js/LICENSE.md](https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md)


- [sizzlemctwizzle/GM_config: A lightweight, reusable, cross-browser graphical settings framework for inclusion in user scripts.](https://github.com/sizzlemctwizzle/GM_config)
    [GNU Lesser General Public License v3.0](https://github.com/sizzlemctwizzle/GM_config/blob/master/LICENSE)
    - [About | GM_config | Libraries | OpenUserJS](https://openuserjs.org/libs/sizzle/GM_config)
      - https://openuserjs.org/src/libs/sizzle/GM_config.min.js
    - [sizzlemctwizzle/GM_config CDN by jsDelivr - A CDN for npm and GitHub](https://www.jsdelivr.com/package/gh/sizzlemctwizzle/GM_config)
      - https://cdn.jsdelivr.net/gh/sizzlemctwizzle/GM_config@43fd0fe4de1166f343883511e53546e87840aeaf/gm_config.js
*/

/*
The MIT License (MIT)

Copyright (c) 2016 furyu <furyutei@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

( function ( w, d ) {

'use strict';

var SCRIPT_NAME = 'twOpenOriginalImage',
    SCRIPT_NAME_JA = '原寸びゅー',
    
    IS_TOUCHED = ( function () {
        var touched_id = SCRIPT_NAME + '_touched',
            touched_element = d.querySelector( '#' + touched_id );
        
        if ( touched_element ) {
            return true;
        }
        
        touched_element = d.createElement( 'b' );
        touched_element.id = touched_id;
        touched_element.style.display = 'none';
        
        d.documentElement.appendChild( touched_element );
        
        return false;
    } )();

if ( IS_TOUCHED ) {
    console.error( SCRIPT_NAME + ': Already loaded.' );
    return;
}
    

if ( /^https:\/\/twitter\.com\/i\/cards/.test( w.location.href ) ) {
    // https://twitter.com/i/cards/～ では実行しない
    return;
}

// ■ パラメータ
var OPTIONS = {
    SHOW_IN_DETAIL_PAGE : true // true: 詳細ページで動作
,   SHOW_IN_TIMELINE : true // true: タイムラインで動作
,   ENABLED_ON_TWEETDECK : true // true: TweetDeck 上で有効
,   DISPLAY_ALL_IN_ONE_PAGE : true // true: [Click] 全ての画像を同一ページで開く / [Alt]+[Click] 画像を個別に開く、false: 左記の逆の動作
,   DISPLAY_OVERLAY : true // true: 全ての画像を同一ページで開く際に(別タブで開かず)タイムライン上にオーバーレイする
,   OVERRIDE_CLICK_EVENT : true // true: ツイート中の画像クリックで原寸画像を開く
,   DISPLAY_ORIGINAL_BUTTONS : true // true: [原寸画像]ボタンを表示
,   OVERRIDE_GALLERY_FOR_TWEETDECK : true // true: TweetDeck のギャラリー(画像サムネイルクリック時のポップアップ)を置換(OVERRIDE_CLICK_EVENT true 時のみ有効)
,   DOWNLOAD_HELPER_SCRIPT_IS_VALID : true // true: ダウンロードヘルパー機能有効
,   DOWNLOAD_ZIP_IS_VALID : true // true: ZIPダウンロード有効
,   SWAP_IMAGE_URL : false // true: タイムラインの画像を orig 画像と差し替え
,   HIDE_DOWNLOAD_BUTTON_AUTOMATICALLY : true // true: ダウンロードボタンを自動的に隠す(オーバーレイ表示時)
,   SUPPRESS_FILENAME_SUFFIX : false // true : ファイル名の接尾辞(-orig等)抑制
,   SHOW_IMAGES_OF_QUOTE_TWEET : true // true : 引用ツイート中の画像も対象とする
,   SAME_FILENAME_AS_IN_ZIP : true // true : 個別ダウンロード時のファイル名をZIPのものと揃える
,   DOWNLOAD_GIF_AS_GIF : true // true : GIF(アニメーション)を .gif に変換して保存 / false : 元の .mp4 のまま保存
,   DISPLAY_BULK_SELECT_BUTTONS : true // true : 一括ダウンロード用の選択ボタンを表示

,   OPERATION : true // true: 動作中、false: 停止中

,   WAIT_AFTER_OPENPAGE : 500 // Firefox でページを開いた後、画像を挿入するまでのタイムラグ(ms)
    // TODO: Firefox(Greasemonkey) で window.open() した後 document を書きかえるまでにウェイトをおかないとうまく行かない
,   KEYCODE_DISPLAY_IMAGES : 86 // 画像を開くときのキーコード(keydown用)(86=[v])
,   KEYCODE_CLOSE_OVERLAY : 27 // 画像を閉じるときのキー(keydown用)(27=[Esc])(※オーバーレイ時のみ)
,   HELP_KEYCHAR_DISPLAY_IMAGES : 'v'
,   SCROLL_STEP : 100 // オーバーレイ表示時の[↑][↓]によるスクロール単位(pixel)
,   SMOOTH_SCROLL_STEP : 100 // オーバーレイ表示時のスムーズスクロール単位(pixel)
,   SMOOTH_SCROLL_INTERVAL : 10 // オーバーレイ表示時のスムーズスクロールの間隔(ms)
,   DEFAULT_IMAGE_SIZE : 'fit-window' // オーバーレイ表示時の画像幅初期値 ( 'full' / 'fit-width' / 'fit-height' / 'fit-window' )
,   DEFAULT_IMAGE_BACKGROUND_COLOR : 'black' // オーバーレイ表示時の画像背景色初期値 ('black' または 'white')
,   GIF_FRAMES_PER_SECOND : 20 // GIF 変換時のフレームレート (100 を割り切れる値: 10, 20, 25)
,   GIF_FRAMES_PER_SECOND_LONG : 10 // GIF 変換時のフレームレート (GIF_LONG_DURATION_SEC より長い場合)
,   GIF_LONG_DURATION_SEC : 15
};


// 共通変数
var DEBUG = false,
    
    make_is_url_function = function ( reg_url ) {
        return function ( url ) {
            if ( ! url ) {
                url = w.location.href;
            }
            return reg_url.test( url );
        };
    }, // end of make_is_url_function()
    
    is_twitter = make_is_url_function( /^https?:\/\/(?:mobile\.)?x\.com\// ), // twitter
    is_tweetdeck = make_is_url_function( /^https?:\/\/pro\.x\.com\// ), // twitter tweetdeck
    is_media_url = make_is_url_function( /^https?:\/\/pbs\.twimg\.com\/media\// ),
    is_react_page = ( () => {
        const
            is_react_page = !! d.querySelector( 'div#react-root' );
        return () => is_react_page;
    } )(),
    is_react_twitter = ( () => {
        const
            is_react_twitter = is_react_page() && is_twitter();
        return () => is_react_twitter;
    } )(),
    is_react_tweetdeck = ( () => {
        const
            is_react_tweetdeck = is_react_page() && is_tweetdeck();
        return () => is_react_tweetdeck;
    } )(),
    is_legacy_twitter = ( () => {
        const
            is_legacy_twitter = ( ! is_react_page() ) && is_twitter();
        return () => is_legacy_twitter;
    } )(),
    is_legacy_tweetdeck = ( () => {
        const
            is_legacy_tweetdeck = ( ! is_react_page() ) && is_tweetdeck();
        return () => is_legacy_tweetdeck;
    } )(),
    
    LANGUAGE = ( function () {
        var lang = 'en';
        
        try {
            // デフォルトはブラウザの設定を使用
            lang = ( w.navigator.browserLanguage || w.navigator.language || w.navigator.userLanguage ).substr( 0, 2 );
        }
        catch ( error ) {
        }
        
        if ( is_twitter() ) {
            try {
                // twitter.com の場合は、サイトの言語設定に従う
                lang = d.querySelector( 'html' ).getAttribute( 'lang' );
            }
            catch ( error ) {
            }
        }
        
        return lang;
    } )(),
    
    FONT_FAMILY = 'Arial, "ヒラギノ角ゴ Pro W3", "Hiragino Kaku Gothic Pro", Osaka, メイリオ, Meiryo, "ＭＳ Ｐゴシック", "MS PGothic", sans-serif',
    
    LOADING_SVG = `
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M94,50 a44,44,0,1,1,-44,-44" stroke="currentColor" fill="none" stroke-width="12">
                <animateTransform attributeName="transform" type="rotate" dur="1s" from="0,50,50" to="360,50,50" repeatCount="indefinite" />
            </path>
        </svg>
    `;

/*
//const // 参照: [Firefox のアドオン(content_scripts)でXMLHttpRequestやfetchを使う場合の注意 - 風柳メモ](https://memo.furyutei.com/entry/20180718/1531914142)
//    fetch = (typeof content != 'undefined' && typeof content.fetch == 'function') ? content.fetch  : window.fetch;
//[覚書] Firefox上のTweetDeck(legacy)ではcontent.fetch()を使うとCSP("connect-src")絡みで画像のダウンロードができなくなってしまう模様(Uncaught (in promise) TypeError: NetworkError when attempting to fetch resource.)(2023/08/14)
*/

switch ( LANGUAGE ) {
    case 'ja' :
        OPTIONS.TITLE_PREFIX = '画像: ';
        OPTIONS.TWEET_LINK_TEXT = '元ツイート⤴';
        OPTIONS.CLOSE_TEXT = '☒ 閉じる[Esc]';
        OPTIONS.BUTTON_TEXT = '原寸画像';
        OPTIONS.BUTTON_HELP_DISPLAY_ALL_IN_ONE_PAGE = '全ての画像を同一ページで開く';
        OPTIONS.BUTTON_HELP_DISPLAY_ONE_PER_PAGE = '画像を個別に開く';
        OPTIONS.DOWNLOAD_HELPER_BUTTON_TEXT = 'ダウンロード';
        OPTIONS.HELP_KEYPRESS_DISPLAY_IMAGES = '原寸画像を開く 【' + SCRIPT_NAME_JA + '】';
        OPTIONS.HELP_OVERLAY_SHORTCUT_MOVE_NEXT = '[j]次の画像';
        OPTIONS.HELP_OVERLAY_SHORTCUT_MOVE_PREVIOUS = '[k]前の画像';
        OPTIONS.HELP_OVERLAY_SHORTCUT_DOWNLOAD = '[d]保存';
        OPTIONS.HELP_OVERLAY_SHORTCUT_DOWNLOAD_ZIP = '[z]ZIP';
        OPTIONS.HELP_OVERLAY_SHORTCUT_SIZE = '[s]サイズ:';
        OPTIONS.HELP_OVERLAY_SHORTCUT_SIZE_FULL = '原寸';
        OPTIONS.HELP_OVERLAY_SHORTCUT_SIZE_FIT_WIDTH = '幅調節';
        OPTIONS.HELP_OVERLAY_SHORTCUT_SIZE_FIT_HEIGHT = '高さ調節';
        OPTIONS.HELP_OVERLAY_SHORTCUT_SIZE_FIT_WINDOW = '全体表示';
        OPTIONS.HELP_OVERLAY_SHORTCUT_BGCOLOR = '[b]背景:';
        OPTIONS.HELP_OVERLAY_SHORTCUT_BGCOLOR_BLACK = '黒';
        OPTIONS.HELP_OVERLAY_SHORTCUT_BGCOLOR_WHITE = '白';
        OPTIONS.BULK_SELECT_HELP = '一括ダウンロードの対象として選択';
        OPTIONS.BULK_SELECTED_COUNT = '選択中: ';
        OPTIONS.BULK_DOWNLOAD_ZIP_TEXT = 'ZIP';
        OPTIONS.BULK_CLEAR_TEXT = '選択解除';
        OPTIONS.BULK_PREPARING_TEXT = '準備中';
        OPTIONS.BULK_DOWNLOADING_TEXT = 'ダウンロード中';
        OPTIONS.BULK_ZIPPING_TEXT = 'ZIP作成中';
        OPTIONS.BULK_DONE_TEXT = '完了';
        OPTIONS.BULK_FAILED_TEXT = '失敗';
        OPTIONS.GIF_CONVERTING_TEXT = 'GIF変換中';
        OPTIONS.MEDIA_INFO_ERROR_TEXT = 'この投稿の動画情報を取得できませんでした。';
        break;
    default :
        OPTIONS.TITLE_PREFIX = 'IMG: ';
        OPTIONS.TWEET_LINK_TEXT = 'Tweet';
        OPTIONS.CLOSE_TEXT = 'Close [Esc]';
        OPTIONS.BUTTON_TEXT = 'Display Original';
        OPTIONS.BUTTON_HELP_DISPLAY_ALL_IN_ONE_PAGE = 'Display all in one page';
        OPTIONS.BUTTON_HELP_DISPLAY_ONE_PER_PAGE = 'Display one image per page';
        OPTIONS.DOWNLOAD_HELPER_BUTTON_TEXT = 'Download';
        OPTIONS.HELP_KEYPRESS_DISPLAY_IMAGES = 'Display original images (' + SCRIPT_NAME + ')';
        OPTIONS.HELP_OVERLAY_SHORTCUT_MOVE_NEXT = '[j]next';
        OPTIONS.HELP_OVERLAY_SHORTCUT_MOVE_PREVIOUS = '[k]previous';
        OPTIONS.HELP_OVERLAY_SHORTCUT_DOWNLOAD = '[d]download';
        OPTIONS.HELP_OVERLAY_SHORTCUT_DOWNLOAD_ZIP = '[z]ZIP';
        OPTIONS.HELP_OVERLAY_SHORTCUT_SIZE = '[s]size:';
        OPTIONS.HELP_OVERLAY_SHORTCUT_SIZE_FULL = 'full';
        OPTIONS.HELP_OVERLAY_SHORTCUT_SIZE_FIT_WIDTH = 'fit-width';
        OPTIONS.HELP_OVERLAY_SHORTCUT_SIZE_FIT_HEIGHT = 'fit-height';
        OPTIONS.HELP_OVERLAY_SHORTCUT_SIZE_FIT_WINDOW = 'fit-window';
        OPTIONS.HELP_OVERLAY_SHORTCUT_BGCOLOR = '[b]bgcolor:';
        OPTIONS.HELP_OVERLAY_SHORTCUT_BGCOLOR_BLACK = 'black';
        OPTIONS.HELP_OVERLAY_SHORTCUT_BGCOLOR_WHITE = 'white';
        OPTIONS.BULK_SELECT_HELP = 'Select for bulk download';
        OPTIONS.BULK_SELECTED_COUNT = 'Selected: ';
        OPTIONS.BULK_DOWNLOAD_ZIP_TEXT = 'ZIP';
        OPTIONS.BULK_CLEAR_TEXT = 'Clear';
        OPTIONS.BULK_PREPARING_TEXT = 'Preparing';
        OPTIONS.BULK_DOWNLOADING_TEXT = 'Downloading';
        OPTIONS.BULK_ZIPPING_TEXT = 'Creating ZIP';
        OPTIONS.BULK_DONE_TEXT = 'Done';
        OPTIONS.BULK_FAILED_TEXT = 'failed';
        OPTIONS.GIF_CONVERTING_TEXT = 'Converting GIF';
        OPTIONS.MEDIA_INFO_ERROR_TEXT = 'Could not get the video information for this post.';
        break;
}

function to_array( array_like_object ) {
    return Array.prototype.slice.call( array_like_object );
} // end of to_array()


if ( typeof console.log.apply == 'undefined' ) {
    // MS-Edge 拡張機能では console.log.apply 等が undefined
    // → apply できるようにパッチをあてる
    // ※参考：[javascript - console.log.apply not working in IE9 - Stack Overflow](https://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9)
    
    [ 'log', 'info', 'warn', 'error', 'assert', 'dir', 'clear', 'profile', 'profileEnd' ].forEach( function ( method ) {
        console[ method ] = this.bind( console[ method ], console );
    }, Function.prototype.call );
    
    console.log( 'note: console.log.apply is undefined => patched' );
}


function log_debug() {
    if ( ! DEBUG ) {
        return;
    }
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.log.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_debug()


function log_info() {
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.info.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_info()


function log_warn() {
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.warn.apply( console, arg_list.concat( [ ... arguments ] ) );
} // end of log_warn()


function log_error() {
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.error.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_error()


var object_extender = ( function () {
    // 参考: [newを封印して、JavaScriptでオブジェクト指向する(1): Architect Note](http://blog.tojiru.net/article/199670885.html?seesaa_related=related_article)
    function object_extender( base_object ) {
        var template = object_extender.template,
            mixin_object_list = Array.prototype.slice.call( arguments, 1 ),
            expanded_object;
        
        template.prototype = base_object;
        
        expanded_object = new template();
        
        mixin_object_list.forEach( function ( object ) {
            Object.keys( object ).forEach( function ( name ) {
                expanded_object[ name ] = object[ name ];
            } );
        } );
        
        return expanded_object;
    } // end of object_extender()
    
    
    object_extender.template = function () {};
    
    return object_extender;
} )(); // end of object_extender()


var is_firefox = ( function () {
    var flag = ( 0 <= w.navigator.userAgent.toLowerCase().indexOf( 'firefox' ) );
    
    return function () {
        return flag;
    };
} )(); // end of is_firefox()


var is_ie = ( function () {
    var flag = ( !! ( w.navigator.userAgent.toLowerCase().match( /(?:msie|trident)/ ) ) );
    
    return function () {
        return flag;
    };
} )(); // end of is_ie()


var is_mac = ( function () {
    var flag = ( 0 <= w.navigator.platform.toLowerCase().indexOf( 'mac' ) );
    
    return function () {
        return flag;
    };
} )(); // end of is_mac()


var is_edge = ( function () {
    var flag = ( 0 <= w.navigator.userAgent.toLowerCase().indexOf( 'edge' ) );
    
    return function () {
        return flag;
    };
} )(); // end of is_edge()


var is_arraybuffer_bug = ( function () {
    if ( ! is_edge() ) {
        return function () {
            return false;
        };
    }
    
    try {
        // TODO: MS-Edge (Microsoft Edge 41.16299.15.0/Microsoft EdgeHTML 16.16299) の拡張機能で、ZIP ダウンロード不可。
        
        // MS-Edge の拡張機能内では、fetch() を使用したり、XMLHttpRequest で xhr.responseType を 'arraybuffer' にして、xhr.response を得ようとすると
        // 「SCRIPT65535: 未定義のエラーです。」となってしまう(Microsoft Edge 41.16299.15.0/Microsoft EdgeHTML 16.16299)
        // ※ 参考： [Fetch API in Extension SCRIPT65535 error - Microsoft Edge Development](https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/14192157/)
        // xhr.responseType = 'blob' なら通るので、Blob で受けてから ArrayBuffer に変換後に JSZip に渡したが、これも内部でエラー発生
        fetch( 'https://pbs.twimg.com/profile_images/318199851/kaze2_mini.png' ).then( function ( response ) {
            return response.arrayBuffer();
        } );
        
        return function () {
            return false;
        };
    }
    catch ( error ) {
        log_error( 'Some bugs in MS-Edge Extension' );
        return function () {
            return true;
        };
    }
} )(); // end of is_arraybuffer_bug()


var is_bookmarklet = ( function () {
    var flag =  ( !! ( w[ SCRIPT_NAME + '_bookmarklet' ] ) );
    
    return function () {
        return flag;
    };
} )(); // end of is_bookmarklet()


var is_extension = ( function () {
    var flag = ( typeof w.twOpenOriginalImage_chrome_init == 'function' );
    
    return function () {
        return flag;
    };
} )(); // end of is_extension()

var body_computed_style = getComputedStyle( d.body );

function is_night_mode() {
    if ( is_react_page() ) {
        // 新 Twitter 用判定
        /*
        //var header_elem = d.querySelector( 'header[role="banner"]' );
        //if ( header_elem ) {
        //    if ( header_elem.querySelector( ':scope > .r-14lw9ot, :scope > .rn-14lw9ot' ) ) {
        //        return false;
        //    }
        //    else if ( header_elem.querySelector( ':scope > .r-bie543, :scope > .rn-bie543' ) ) {
        //        return true;
        //    }
        //}
        */
        try {
            return ( body_computed_style.backgroundColor != 'rgb(255, 255, 255)' );
            // [2019.08.07] メニューがサイドバーの「ダークモード」から、「もっと見る」＞「表示」＞「背景画像」に変更、種類も3種になった
            // → document.body の background-color で判定（デフォルト: rgb(255, 255, 255)・ダークブルー: rgb(21, 32, 43)・ブラック: rgb(0, 0, 0)）
            
            // TODO: 下記のようなエラーが記録されることがあり、回避方法不明（try~catchにもかからない）→別の拡張機能がフォントを読み込もうとしているためか？（とりあえず保留）
            //  Refused to load the font 'https://fonts.gstatic.com/s/materialicons/v31/2fcrYFNaTjcS6g4U3t-Y5UEw0lE80llgEseQY3FEmqw.woff2' because it violates the following Content Security Policy directive: "font-src 'self' https://*.twimg.com".
        }
        catch ( error ) {
            return false;
        }
    }
    else {
        // TweetDeck 用判定
        var html_elem = d.querySelector( 'html' );
        if ( html_elem.classList.contains( 'night_mode' ) || html_elem.classList.contains( 'dark' ) ) {
            return true;
        }
        
        // 旧 Twitter 用判定
        var nightmode_icon = d.querySelector( '#user-dropdown .js-nightmode-icon' );
        if ( ! nightmode_icon ) {
            return false;
        }
        return ( nightmode_icon.classList.contains( 'Icon--lightBulbOff' ) || nightmode_icon.classList.contains( 'Icon--crescentFilled' ) );
    }
} // end of is_night_mode()


function has_some_classes( node, class_list ) {
    if ( ! Array.isArray( class_list ) ) {
        class_list = [ class_list ];
    }
    
    return class_list.some( function ( class_name, index, self ) {
        return node.classList.contains( class_name );
    } );
} // end of has_some_classes()


function search_ancestor( node, class_list, contains_self ) {
    var ancestor = null;
    
    if ( ! contains_self ) {
        node = node.parentNode;
    }
    
    while ( node && ( node.nodeType == 1 ) ) {
        if ( has_some_classes( node, class_list ) ) {
            ancestor = node;
            break;
        }
        node = node.parentNode;
    }
    return ancestor;
    
} // end of search_ancestor()


function search_ancestor_by_attribute( node, name, value, contains_self ) {
    var ancestor = null,
        value_list = Array.isArray( value ) ? value : [ value ];
    
    if ( ! contains_self ) {
        node = node.parentNode;
    }
    
    while ( node && ( node.nodeType == 1 ) ) {
        if ( ( value === undefined ) || ( value === null ) ) {
            if ( node.getAttribute( name ) !== null ) {
                ancestor = node;
                break;
            }
        }
        else if ( 0 <= value_list.indexOf( node.getAttribute( name ) ) ) {
            ancestor = node;
            break;
        }
        node = node.parentNode;
    }
    return ancestor;
    
} // end of search_ancestor_by_attribute()


function import_node( node, doc ) {
    if ( ! doc ) {
        doc = d;
    }
    if ( doc === d ) {
        return node.cloneNode( true );
    }
    try {
        return doc.importNode( node, true );
    }
    catch ( error ) {
        var source_container = d.createElement( 'div' ),
            target_container = doc.createElement( 'div' );
        
        source_container.appendChild( node );
        target_container.innerHTML = source_container.innerHTML;
        source_container.removeChild( node );
        
        var imported_node = target_container.removeChild( target_container.firstChild );
        
        return imported_node;
    }
} // end of import_node()


function clear_node( node ) {
    while ( node.firstChild ) {
        node.removeChild( node.firstChild );
    }
} // end of clear_node()


var escape_html = ( function () {
    var escape_map = {
            '&' : '&amp;'
        ,   '"' : '&quot;'
        ,   '\'' : '&#39;'
        ,   '<' : '&lt;'
        ,   '>' : '&gt;'
        },
        re_escape = /[&"'<>]/g;
    
    function escape_char( char ) {
        if ( ! ( char in escape_map ) ) {
            return char;
        }
        return escape_map[ char ];
    }
    
    function escape_html( html ) {
        return String( html ).replace( re_escape, escape_char );
    }
    
    return escape_html;
} )(); // end of escape_html()


const
    parse_cookies = ( cookie_string ) => {
        if ( ! cookie_string ) {
            cookie_string = document.cookie;
        }
        const
            cookie_map = cookie_string.split( ';' )
            .map( ( part_string ) => part_string.split( '=' ) )
            .reduce( ( cookie_map, [ name, value ] ) => {
                cookie_map[ decodeURIComponent( name.trim() ) ] = decodeURIComponent( value.trim() );
                return cookie_map;
            }, Object.create( null ) );
        return cookie_map;
    },
    
    get_cookie = ( name ) => parse_cookies()[ name ];


function get_scroll_top( doc ) {
    if ( ! doc ) {
        doc = d;
    }
    return ( doc.body.scrollTop || doc.documentElement.scrollTop );
} // end of get_scroll_top()


function get_element_position( element, win ) {
    if ( ! win ) {
        win = w;
    }
    var rect = element.getBoundingClientRect();
    
    return {
        x : rect.left + win.pageXOffset
    ,   y : rect.top + win.pageYOffset
    };
} // end of get_element_position()


function fire_event( target_element, event_kind, doc ) {
    if ( ! doc ) {
        doc = d;
    }
    var cutsom_event = doc.createEvent( 'HTMLEvents' );
    
    cutsom_event.initEvent( event_kind, true, false );
    target_element.dispatchEvent( cutsom_event );
} // end of fire_event()


function get_mouse_position( event ) {
    var mouse_position = {
            x : event.pageX
        ,   y : event.pageY
        };
    
    return mouse_position;
} // end of get_mouse_position()


var event_functions = object_extender( {
    event_dict : {},
    
    binded_object : null,
    
    
    add_event : function ( target, event_name, event_function, for_storage ) {
        var self = this,
            event_dict = self.event_dict,
            binded_object = self.binded_object;
        
        if ( ! for_storage ) {
            target.addEventListener( event_name, event_function, false );
            return self;
        }
        
        function _event_function() {
            event_function.apply( ( ( binded_object ) ? binded_object : w ), arguments );
        } // end of _event_function()
        
        target.addEventListener( event_name, _event_function, false );
        
        var event_items = event_dict[ event_name ];
        
        if ( ! event_items ) {
            event_items = event_dict[ event_name ] = [];
        }
        
        event_items.push( {
            target : target
        ,   event_function : event_function
        ,   _event_function : _event_function
        } );

        return self;
    }, // end of add_event()
    
    
    remove_event : function ( target, event_name, event_function ) {
        var self = this,
            event_dict = self.event_dict,
            event_items = event_dict[ event_name ],
            is_found = false;
        
        if ( event_items ) {
            event_dict[ event_name ] = event_items.filter( function ( event_item ) {
                if ( ( event_item.target === target ) && ( ( ! event_function ) || ( event_item.event_function === event_function ) ) ) {
                    target.removeEventListener( event_name, event_item._event_function, false );
                    is_found = true;
                    return false;
                }
                return true;
            } );
        }
        
        if ( ! is_found && event_function ) {
            target.removeEventListener( event_name, event_function, false );
        }
        
        return self;
    }, // end of remove_event()
    
    
    bind_object : function ( target_object ) {
        var self = this;
        
        self.binded_object = target_object;
        
        return self;
    }, // end of bind_object()
} );


function add_event() {
    return event_functions.bind_object( this ).add_event.apply( event_functions, arguments );
} // end of add_event()


function remove_event() {
    return event_functions.bind_object( this ).remove_event.apply( event_functions, arguments );
} // end of add_event()


function get_url_info( url ) {
    // [注意] url は https?:// 以外（画像ファイル名など）の場合あり（※その場合はnew URL(url)とするとエラー発生）
    var url_parts = url.split( '?' ),
        query_map = {},
        url_info = { base_url : url_parts[ 0 ], query_map : query_map };
    
    if ( url_parts.length < 2 ) {
        return url_info;
    }
    
    url_parts[ 1 ].split( '&' ).forEach( function ( query_part ) {
        var parts = query_part.split( '=' );
        
        query_map[ parts[ 0 ] ] = ( parts.length < 2 ) ? '' : parts[ 1 ];
    } );
    
    return url_info;
} // end of get_url_info()


function normalize_img_url( source_url ) {
    var url_info = get_url_info( source_url ),
        base_url = url_info.base_url,
        format = url_info.query_map.format,
        name = url_info.query_map.name;
    
    if ( ! format ) {
        return source_url;
    }
    
    if ( [ 'thumb', 'small', 'medium', 'large', 'orig', '900x900' ].indexOf( name ) < 0 ) {
        name = '';
    }
    
    if ( base_url.match( /^(.*)\.(\w+)$/ ) ) {
        base_url = RegExp.$1;
        format = RegExp.$2;
    }
    
    return base_url + '.' + format + ( ( name ) ? ':' + name : '' );
} // end of normalize_img_url()


function get_img_extension( img_url, extension_list ) {
    img_url = normalize_img_url( img_url );
    
    var extension = '';
    
    extension_list = ( extension_list ) ? extension_list : [ 'png', 'jpg', 'gif', 'webp' ];
    
    if ( img_url.match( new RegExp( '\.(' + extension_list.join('|') + ')' ) ) ) {
        extension = RegExp.$1;
    }
    return extension;
} // end of get_img_extension()


function get_img_kind( img_url ) {
    img_url = normalize_img_url( img_url );
    
    var kind = 'medium';
    
    if ( img_url.match( /:(\w*)$/ ) ) {
        kind = RegExp.$1;
    }
    return kind;
} // end of get_img_kind()


function get_img_url( img_url, kind, old_format ) {
    img_url = normalize_img_url( img_url );
    var orig_img_url = img_url;
    
    if ( old_format ) {
        if ( ! kind ) {
            kind = '';
        }
        else {
            if ( kind.search( ':' ) != 0 ) {
                kind = ':' + kind;
            }
        }
        img_url = img_url.replace( /:\w*$/, '' ) + kind;
        //img_url = img_url.replace( /\.webp:orig$/, '.jpg:orig' ); // [2023-08-06] format=webpにはname=origが存在しないため、ひとまずformat=jpgに置換
    }
    else {
        if ( ! kind ) {
            kind = 'orig';
        }
        kind = kind.replace( /:/g, '' );
        if ( ! /:\w*$/.test( img_url ) ) {
            img_url += ':' + kind;
        }
        
        img_url = img_url.replace( /\.([^.]+):\w*$/, '' ) + '?format=' + RegExp.$1 + '&name=' + kind;
        //img_url = img_url.replace( /format=webp&name=orig$/, 'format=jpg&name=orig' ); // [2023-08-06] format=webpにはname=origが存在しないため、ひとまずformat=jpgに置換
    }
    
    return img_url;
} // end of get_img_url()


function get_img_url_orig( img_url ) {
    if ( /^https?:\/\/ton\.x\.com\//.test( img_url ) ) { // twitter
        // DM の画像は :orig が付かないものが最大
        return get_img_url( img_url );
    }
    return get_img_url( img_url, 'orig' );
} // end of get_img_url_orig()


function get_img_filename( img_url ) {
    img_url = normalize_img_url( img_url );
    
    if ( ! img_url.match( /^.+\/([^\/.]+)\.(\w+):(\w+)$/ ) ) {
        return img_url;
    }
    
    var base = RegExp.$1,
        ext = RegExp.$2,
        suffix = RegExp.$3;
    
    if ( OPTIONS.SUPPRESS_FILENAME_SUFFIX ) {
        return base + '.' + ext;
    }
    else {
        return base + '-' + suffix + '.' + ext;
    }
} // end of get_img_filename()


var is_video_url = make_is_url_function( /^https?:\/\/video\.twimg\.com\// );


function get_media_type( media_url ) {
    // 'photo' (pbs.twimg.com/media) / 'video' (video.twimg.com) / 'animated_gif' (video.twimg.com/tweet_video)
    if ( ! is_video_url( media_url ) ) {
        return 'photo';
    }
    return ( /\/tweet_video\//.test( media_url ) ) ? 'animated_gif' : 'video';
} // end of get_media_type()


function get_media_key( media_url ) {
    // 同一メディア判定用(クエリ・サイズ指定を除去)
    return ( media_url || '' ).replace( /[?#].*$/, '' ).replace( /(\/media\/[^\/.:]+).*$/, '$1' );
} // end of get_media_key()


function get_media_label( media_url ) {
    switch ( get_media_type( media_url ) ) {
        case 'video' :
            return 'video';
        case 'animated_gif' :
            return 'gif';
        default :
            return 'img';
    }
} // end of get_media_label()


function get_media_extension( media_url ) {
    switch ( get_media_type( media_url ) ) {
        case 'video' :
            return 'mp4';
        case 'animated_gif' :
            return ( OPTIONS.DOWNLOAD_GIF_AS_GIF ) ? 'gif' : 'mp4';
        default :
            return get_img_extension( media_url );
    }
} // end of get_media_extension()


function get_media_filename( media_url, extension ) {
    if ( get_media_type( media_url ) == 'photo' ) {
        return get_img_filename( media_url );
    }
    // https://video.twimg.com/ext_tw_video/(id)/pu/vid/avc1/1280x720/(name).mp4?tag=12 => (name).mp4
    var base = media_url.replace( /[?#].*$/, '' ).replace( /^.*\//, '' ).replace( /\.\w+$/, '' );
    
    return base + '.' + ( extension || get_media_extension( media_url ) );
} // end of get_media_filename()


function get_zip_media_filename( filename_prefix, media_url, index, extension ) {
    return filename_prefix + '-' + get_media_label( media_url ) + ( index + 1 ) + '.' + ( extension || get_media_extension( media_url ) );
} // end of get_zip_media_filename()


function get_best_video_url( media_info ) {
    var variant_list = ( media_info?.video_info?.variants || [] ).filter( ( variant ) => ( ( variant.content_type == 'video/mp4' ) && variant.url ) );
    
    if ( variant_list.length <= 0 ) {
        return null;
    }
    return variant_list.reduce( ( best, variant ) => ( ( ( best.bitrate || 0 ) < ( variant.bitrate || 0 ) ) ? variant : best ) ).url;
} // end of get_best_video_url()


function get_media_url_from_media_info( media_info ) {
    switch ( media_info?.type ) {
        case 'photo' :
            return ( media_info.media_url_https ) ? get_img_url_orig( media_info.media_url_https ) : null;
        
        case 'video' :
        case 'animated_gif' :
            return get_best_video_url( media_info );
    }
    return null;
} // end of get_media_url_from_media_info()


async function get_tweet_media_urls( tweet_id, include_quoted ) {
    // API(取得済みのレスポンス/TweetDetail/syndication)からメディアURL(画像は原寸・動画は最高ビットレート)を取得
    if ( ( ! tweet_id ) || ( typeof w.extension_functions?.async_get_tweet_info != 'function' ) ) {
        return null;
    }
    var tweet_info = await w.extension_functions.async_get_tweet_info( tweet_id );
    
    if ( ! tweet_info ) {
        return null;
    }
    var media_list = ( tweet_info.media_list || [] ).slice( 0 );
    
    if ( include_quoted && tweet_info.quoted_tweet_id ) {
        var quoted_tweet_info = await w.extension_functions.async_get_tweet_info( tweet_info.quoted_tweet_id );
        
        media_list = media_list.concat( quoted_tweet_info?.media_list || [] );
    }
    return media_list.map( get_media_url_from_media_info ).filter( ( media_url ) => !! media_url );
} // end of get_tweet_media_urls()


function get_tweet_id_from_tweet_url( tweet_url ) {
    if ( tweet_url.match( /^(?:https?:\/\/(?:mobile\.)?x\.com)?\/[^\/]+\/status(?:es)?\/(\d+).*$/ ) ) { // twitter
        return RegExp.$1;
    }
    return null;
} // end of get_tweet_id_from_tweet_url()


function get_timestamp_ms_from_tweet_id( tweet_id ) {
    if ( isNaN( tweet_id ) ) {
        return null;
    }
    tweet_id = parseInt( tweet_id, 10 );
    
    if ( tweet_id <= 30000000000 ) {
        return null;
    }
    return ( 1288834974657 + ( tweet_id / ( 1 << 22 ) ) );
} // end of get_timestamp_ms_from_tweet_id()


function get_timestamp_ms_from_tweet_url( tweet_url ) {
    var tweet_id = get_tweet_id_from_tweet_url( tweet_url );
    
    if ( tweet_id ) {
        return get_timestamp_ms_from_tweet_id( tweet_id );
    }
    return null;
} // end of get_timestamp_ms_from_tweet_url()


function get_datetime_string_from_timestamp_ms( timestamp_ms ) {
    if ( ( ! timestamp_ms ) || isNaN( timestamp_ms ) ) {
        return '';
    }
    return ( new Date( parseInt( timestamp_ms, 10 ) ).toLocaleString().replace( /\u200e/g, '' ) ); // MS-Edge では U+200E (LEFT-TO-RIGHT MARK) が含まれてしまう
} // end of get_datetime_string_from_timestamp_ms()


// TODO: zip.file() で date オプションを指定した際、ZIP のタイムスタンプがずれてしまう
// => 暫定対応
function adjust_date_for_zip( date ) {
    // TODO: なぜかタイムスタンプに1秒前後の誤差が出てしまう
    return new Date( date.getTime() - date.getTimezoneOffset() * 60000 );
} // end of adjust_date_for_zip()


function is_tweet_detail_on_react_twitter( tweet ) {
    //return ( tweet.getAttribute( 'data-testid' ) == 'tweetDetail' );
    // ※ [2019.08.07] article[data-testid="tweetDetail"] は無くなり、article[role="article"] に置き換わっている
    //return ! tweet.querySelector( 'a[role="link"][href^="/"][href*="/status/"] time' );
    // ※ TODO: 個別ツイートを判別方法要検討（暫定的に、個別ツイートへのリンク(タイムスタンプ)有無で判定）
    //return !! tweet.querySelector('a[role="link"][href*="/status/"] ~ a[role="link"][href*="/help.twitter.com/"]');
    // [2022.09] 個別ツイートでも 'a[role="link"][href^="/"][href*="/status/"] time' でマッチするようになったため、判定方法変更
    const
        location_tweet_id = get_tweet_id_from_tweet_url( location.href ),
        timestamp_container = tweet.querySelector( 'a[role="link"][href^="/"][href*="/status/"] time' ),
        tweet_link = timestamp_container ? search_ancestor_by_attribute( timestamp_container, 'role', 'link' ) : null,
        tweet_id = get_tweet_id_from_tweet_url( tweet_link?.href ?? '' );
    log_debug( ( location_tweet_id == tweet_id ), `location_tweet_id=${location_tweet_id} vs tweet_id=${tweet_id}` );
    return ( ( location_tweet_id ) && ( tweet_id ) && ( location_tweet_id == tweet_id ) );
    // [2023.08] a[role="link"][href*="/help.twitter.com/"]が存在しなくなっている／自身へのリンクは存在
} // end of is_tweet_detail_on_react_twitter()


function get_tweet_link_on_react_twitter( tweet ) {
    var tweet_link,
        timestamp_container = tweet.querySelector( [
            'a[role="link"][href^="/"][href*="/status/"] time:last-of-type',
            'a[role="link"][href^="https://x.com/"][href*="/status/"] time:last-of-type', // twitter
            'a[role="link"][href^="https://mobile.x.com/"][href*="/status/"] time:last-of-type', // twitter
        ].join( ',' ) );
    
    if ( timestamp_container ) {
        tweet_link = search_ancestor_by_attribute( timestamp_container, 'role', 'link' );
    }
    /*
    //if ( ( ! tweet_link ) || is_tweet_detail_on_react_twitter( tweet ) ) {
    //    tweet_link = null;
    //    // ※個別ツイートを表示した場合、自身へのリンクが無い→ページのURLをhrefに持つリンクをダミーで作成し、ツイートソースラベルの前に挿入
    //    var tweet_url = w.location.href.replace( /[?#].*$/g, '' ),
    //        tweet_source_label = tweet.querySelector( 'a[role="link"][href*="/help.twitter.com/"]' );
    //    
    //    if ( tweet_source_label ) {
    //        tweet_link = tweet_source_label.parentNode.querySelector( '.' + SCRIPT_NAME + '_tweetdetail_link' );
    //    }
    //    
    //    if ( ! tweet_link ) {
    //        tweet_link = d.createElement( 'a' );
    //        tweet_link.className = SCRIPT_NAME + '_tweetdetail_link';
    //        tweet_link.setAttribute( 'role', 'link' );
    //        tweet_link.style.display = 'none';
    //        
    //        if ( tweet_url.match( /\/status(?:es)?\// ) ) {
    //            tweet_link.setAttribute( 'href', tweet_url );
    //        }
    //        
    //        if ( tweet_source_label ) {
    //            tweet_source_label.parentNode.insertBefore( tweet_link, tweet_source_label );
    //        }
    //    }
    //}
    */
    return tweet_link;
} // end of get_tweet_link_on_react_twitter()


function get_text_from_element( element ) {
    var text = [ ... element.childNodes ].map( node => {
            if ( node.nodeType == Node.TEXT_NODE ) return node.textContent || '';
            if ( node.nodeType != Node.ELEMENT_NODE ) return '';
            if ( node.tagName == 'IMG' ) return node.alt || '';
            return get_text_from_element( node );
        } ).join( '' );
    
    return text;
} // end of get_text_from_element()


function get_natural_width( media_element ) {
    return ( media_element.tagName == 'VIDEO' ) ? media_element.videoWidth : media_element.naturalWidth;
} // end of get_natural_width()


function get_natural_height( media_element ) {
    return ( media_element.tagName == 'VIDEO' ) ? media_element.videoHeight : media_element.naturalHeight;
} // end of get_natural_height()


function download_media_by_link( download_link, filename ) {
    // 動画・GIF のダウンロード(GIF 変換中は進捗をリンクに表示)
    if ( download_link.getAttribute( 'data-downloading' ) == 'yes' ) {
        return;
    }
    var media_url = download_link.href,
        link_text = download_link.textContent;
    
    download_link.setAttribute( 'data-downloading', 'yes' );
    
    save_media_file( media_url, filename, ( ratio ) => {
        download_link.textContent = OPTIONS.GIF_CONVERTING_TEXT + ' ' + Math.floor( ratio * 100 ) + '%';
    } )
    .catch( ( error ) => {
        log_error( 'Download failure:', media_url, filename, error );
        alert( 'Download failure:\n' + media_url );
    } )
    .finally( () => {
        download_link.textContent = link_text;
        download_link.removeAttribute( 'data-downloading' );
    } );
} // end of download_media_by_link()


function get_tweet_author_info( tweet ) {
    var fullname_container,
        fullname,
        username_container,
        username,
        timestamp_container,
        timestamp_ms;
    
    if ( is_react_page() ) {
        //fullname_container = tweet.querySelector( 'a[role="link"] [dir="auto"] > span > span[dir="auto"]' );
        fullname_container = tweet.querySelector( 'a[role="link"] [dir="auto"] > span' );
        //fullname = ( fullname_container ) ? fullname_container.textContent.trim() : '';
        fullname = ( fullname_container ) ? get_text_from_element( fullname_container ).trim() : '';
        username_container = ( fullname_container ) ? search_ancestor_by_attribute( fullname_container, 'role', 'link' ) : null;
        username = ( username_container ) ? new URL( username_container.href ).pathname.replace( /^\//, '' ) : '';
    }
    else {
        fullname_container = tweet.querySelector( '.fullname' );
        //fullname = ( fullname_container ) ? fullname_container.textContent.trim() : '';
        fullname = ( fullname_container ) ? get_text_from_element( fullname_container ).trim() : '';
        username_container = tweet.querySelector( '.username' );
        username = ( username_container ) ? username_container.textContent.trim() : '';
    }
    timestamp_container = tweet.querySelector( '*[data-time-ms], time[data-time]' );
    timestamp_ms = ( timestamp_container ) ? ( timestamp_container.getAttribute( 'data-time-ms' ) || timestamp_container.getAttribute( 'data-time' ) ) : '';
    
    return {
        fullname : fullname,
        username : username,
        timestamp_ms : timestamp_ms,
    };
} // end of get_tweet_author_info()


function get_video_player( video_object ) {
    return video_object.closest( '[data-testid="videoPlayer"], [data-testid="videoComponent"]' );
} // end of get_video_player()


function get_video_objects( container ) {
    // 動画・GIF(<video> もしくはサムネイル画像)を1プレイヤーにつき1要素で返す
    if ( ! is_react_page() ) {
        return [];
    }
    var player_list = [];
    
    return to_array( container.querySelectorAll( 'video, img[src*="_video_thumb/"]' ) ).filter( ( video_object ) => {
        var player = get_video_player( video_object );
        
        if ( ( video_object.tagName == 'VIDEO' ) && ( ! player ) ) {
            var source_url = video_object.querySelector( 'source[src]' )?.src || video_object.getAttribute( 'src' ) || '';
            
            if ( ! /\/\/(?:pbs\.twimg\.com\/[^\/]*video_thumb\/|video\.twimg\.com\/)/.test( ( video_object.getAttribute( 'poster' ) || '' ) + ' ' + source_url ) ) {
                return false;
            }
        }
        if ( ( ! OPTIONS.SHOW_IMAGES_OF_QUOTE_TWEET ) && video_object.closest( 'div[role="link"], [role="blockquote"]' ) ) {
            // 引用ツイート中の動画は対象としない
            return false;
        }
        player = player || video_object;
        if ( 0 <= player_list.indexOf( player ) ) {
            return false;
        }
        player_list.push( player );
        return true;
    } );
} // end of get_video_objects()


function get_gif_url_from_video_object( video_object ) {
    // GIF の場合は DOM から .mp4 の URL がわかる(動画は blob: のため API 経由で取得)
    var is_video_element = ( video_object.tagName == 'VIDEO' ),
        source_url = ( is_video_element ) ? ( video_object.querySelector( 'source[src]' )?.src || video_object.currentSrc || video_object.getAttribute( 'src' ) || '' ) : '',
        thumb_url = video_object.getAttribute( ( is_video_element ) ? 'poster' : 'src' ) || '';
    
    if ( /^https:\/\/video\.twimg\.com\/tweet_video\//.test( source_url ) ) {
        return source_url;
    }
    // https://pbs.twimg.com/tweet_video_thumb/(key).jpg => https://video.twimg.com/tweet_video/(key).mp4
    if ( thumb_url.match( /^https:\/\/pbs\.twimg\.com\/tweet_video_thumb\/([^.?\/]+)/ ) ) {
        return 'https://video.twimg.com/tweet_video/' + RegExp.$1 + '.mp4';
    }
    return null;
} // end of get_gif_url_from_video_object()


/*
//function fetch_status( tweet_id ) {
//    const
//        //auth_bearer = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
//        auth_bearer = 'AAAAAAAAAAAAAAAAAAAAAF7aAAAAAAAASCiRjWvh7R5wxaKkFp7MM%2BhYBqM%3DbQ0JPmjU9F6ZoMhDfI4uTNAaQuTDm2uO9x3WFVr2xBZ2nhjdP0';
//    return fetch(
//        ( is_react_twitter() ? 'https://twitter.com/i/api' : 'https://api.twitter.com' ) + '/1.1/statuses/show.json?include_my_retweet=true&include_entities=true&trim_user=false&include_ext_alt_text=true&include_card_uri=true&tweet_mode=extended&id=' + encodeURIComponent( tweet_id ), {
//        method: 'GET',
//        headers: {
//            'authorization' : `Bearer ${auth_bearer}`,
//            'x-csrf-token' : document.cookie.match( /ct0=(.*?)(?:;|$)/ )[ 1 ],
//            'x-twitter-active-user' : 'yes',
//            'x-twitter-auth-type' : 'OAuth2Session',
//            'x-twitter-client-language' : 'en',
//        },
//        mode: 'cors',
//        credentials : 'include',
//    } )
//    .then( response => {
//        if ( ! response.ok ) {
//            throw new Error( 'Network response was not ok' );
//        }
//        return response.json()
//    } );
//} // end of fetch_status()
*/


const
    fetch_status_json = ( () => {
        const
            //auth_bearer = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA', // Twitter(API 1.1)
            auth_bearer = 'AAAAAAAAAAAAAAAAAAAAAF7aAAAAAAAASCiRjWvh7R5wxaKkFp7MM%2BhYBqM%3DbQ0JPmjU9F6ZoMhDfI4uTNAaQuTDm2uO9x3WFVr2xBZ2nhjdP0', // TweetDeck(legacy)
            
            chrome = ( ( typeof browser != 'undefined' ) && browser.runtime ) ? browser : window.chrome,
            
            async_wait = (wait_msec) => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(wait_msec);
                    }, wait_msec);
                });
            },
            
            wait_background_ready = (() => {
                // [メモ] backgroundの処理を(async() => {…})(); に変更(2023/08/07)
                // →受信準備ができていない場合にエラーになるため、準備できるまで待つ
                const
                    wait_msec = 10;
                let
                    is_ready = false;
                
                return async () => {
                    /*
                    //[TODO] 最初だけのチェックだとなぜかその後のsendMessage()でもエラーが発生する場合がある模様
                    //→暫定的に、常にチェック
                    //if (is_ready) {
                    //    return;
                    //}
                    */
                    for (;;) {
                        try {
                            const
                                response = await chrome.runtime.sendMessage({
                                    type : 'HEALTH_CHECK_REQUEST',
                                });
                            if (response?.is_ready) {
                                log_debug('background is ready', response);
                                is_ready = true;
                                break;
                            }
                        }
                        catch (error) {
                            log_info('sendMessage() error', error);
                        }
                        log_debug(`background is not ready => retry after ${wait_msec} msec`);
                        await async_wait(wait_msec);
                    }
                };
            })(),
            
            content_fetch_json = async (url, options) => {
                try {
                    const
                        response = await fetch(url, options);
                    if (! response.ok) {
                        throw new Error(`${response.status} ${response.statusText}`);
                    }
                    if (response.error) {
                        throw new Error(response.error);
                    }
                    const
                        response_object = await response.json();
                    return response_object;
                }
                catch (error) {
                    throw new Error(error);
                }
            },
            
            background_fetch_json = async (url, options) => {
                await wait_background_ready();
                const
                    response = await chrome.runtime.sendMessage({
                        type : 'FETCH_JSON_REQUEST',
                        url,
                        options,
                    });
                if (response.error) {
                    throw new Error(response.error);
                }
                return response.response_object;
            },
            
            fetch_json = is_extension() ? background_fetch_json : content_fetch_json;
            
        return async ( tweet_id ) => {
            const
                url = `${is_react_page() ? 'https://twitter.com/i/api' : 'https://api.twitter.com'}/1.1/statuses/show.json?include_my_retweet=true&include_entities=true&trim_user=false&include_ext_alt_text=true&include_card_uri=true&tweet_mode=extended&id=${encodeURIComponent( tweet_id )}`,
                options = {
                    method: 'GET',
                    headers: {
                        'authorization' : `Bearer ${auth_bearer}`,
                        'x-csrf-token' : get_cookie( 'ct0' ),
                        'x-twitter-active-user' : 'yes',
                        'x-twitter-auth-type' : 'OAuth2Session',
                        'x-twitter-client-language' : 'en',
                    },
                    mode: 'cors',
                    credentials : 'include',
                };
            
            try {
                const
                    response_object = await fetch_json( url, options );
                return response_object;
            }
            catch ( error ) {
                throw new Error( error );
            }
        };
    } )();


const
    is_valid_image = ( img_url ) => {
        return new Promise( ( resolve, reject ) => {
            const
                try_img = new Image();
            try_img.addEventListener( 'load', ( event ) => {
                resolve( true );
            } );
            try_img.addEventListener( 'error', ( event ) => {
                resolve( false );
            } );
            try {
                try_img.src = img_url;
            }
            catch ( error ) {
                // TODO: Firefox だとうまくいかない場合がある模様
                // Content Security Policy: ページの設定により次のリソースの読み込みをブロックしました: (try_url) ("img-src https://abs.twimg.com https://ssl.google-analytics.com http://www.google-analytics.com")
                resolve( false );
            }
        } );
    },
    
    find_valid_img_url = ( () => {
        const
            img_url_replace_map = {},
            extension_list = [ 'jpg', 'png', 'gif', 'webp' ];
        
        return async ( source_img_url ) => {
            if ( ! source_img_url ) {
                return source_img_url;
            }
            let
                current_extension = get_img_extension( source_img_url, extension_list );
            if ( ! current_extension ) {
                return source_img_url;
            }
            if ( current_extension == 'webp' ) {
                // format=webpにはname=origが存在しないため、ひとまずformat=jpgに置換
                current_extension = 'jpg';
                source_img_url = source_img_url.replace( 'format=webp', `format=${current_extension}` );
            }
            const
                valid_img_url = img_url_replace_map[ source_img_url ];
            if ( valid_img_url ) {
                return valid_img_url;
            }
            if ( await is_valid_image( source_img_url ) ) {
                img_url_replace_map[ source_img_url ] = source_img_url;
                return source_img_url;
            }
            for ( const extension of extension_list ) {
                if ( extension == current_extension ) {
                    continue;
                }
                const
                    try_img_url = source_img_url.replace( `format=${current_extension}`, `format=${extension}` );
                if ( await is_valid_image( try_img_url ) ) {
                    img_url_replace_map[ source_img_url ] = try_img_url;
                    return try_img_url;
                }
            }
            return source_img_url;
        };
    } )();


var DragScroll = {
    is_dragging : false
,   element : null
,   mouse_x : 0
,   mouse_y : 0


,   init : function ( element ) {
        var self = this;
        
        self.element = element;
        
        return self;
    
    } // end of init()


,   start : function () {
        var self = this,
            element = self.element;
        
        self._add_event( element, 'mousedown', self._drag_start, true );
        self._add_event( element, 'mousemove', self._drag_move, true );
        
        return self;
    } // end of start()


,   stop : function () {
        var self = this,
            element = self.element;
        
        self._remove_event( self.element, 'mousemove' );
        self._remove_event( self.element, 'mousedown' );
        
        return self;
    } // end of stop()


,   _add_event : function ( target, event_name, event_function ) {
        var self = this;
        
        add_event.apply( self, arguments );
    } // end of _add_event()


,   _remove_event : function ( target, event_name, event_function ) {
        var self = this;
        
        remove_event.apply( self, arguments );
    } // end of _remove_event()


,   _drag_start : function ( event ) {
        var self = this,
            element = self.element;
        
        if ( self.is_dragging ) {
            return;
        }
        self.is_dragging = true;
        
        var mouse_position = get_mouse_position( event );
        
        self.mouse_x = mouse_position.x;
        self.mouse_y = mouse_position.y;
        
        w.getSelection().removeAllRanges();
    } // end of _drag_start()


,   _drag_stop : function ( event ) {
        var self = this,
            element = self.element;
        
        self.is_dragging = false;
        
        w.getSelection().removeAllRanges();
    } // end of _drag_stop()


,   _drag_move : function ( event ) {
        var self = this,
            element = self.element;
        
        if ( ! self.is_dragging ) {
            return;
        }
        
        if ( ! event.buttons ) {
            self._drag_stop( event );
            return;
        }
        
        var mouse_position = get_mouse_position( event ),
            dx = mouse_position.x - self.mouse_x,
            dy = mouse_position.y - self.mouse_y;
        
        element.scrollLeft -= dx;
        element.scrollTop -= dy;
        
        self.mouse_x = mouse_position.x;
        self.mouse_y = mouse_position.y;
        
        w.getSelection().removeAllRanges();
    } // end of _drag_move()
};


var create_download_link = ( function () {
    var link_template = d.createElement( 'a' ),
        link_style = link_template.style;
    
    link_template.className = 'download-link';
    link_style.display = 'inline-block';
    link_style.fontWeight = 'normal';
    link_style.fontSize = '12px';
    link_style.color = 'gray';
    link_style.background = 'white';
    link_style.textDecoration = 'none';
    link_style.margin = '0 0 0 8px';
    link_style.padding = '4px 8px';
    link_style.border = 'solid 2px';
    link_style.borderRadius = '3px';
    link_style.minWidth = '90px';
    link_style.textAlign = 'center';
    
    function create_download_link( img_url, doc ) {
        if ( ! doc ) {
            doc = d;
        }
        
        var link = import_node( link_template, doc ),
            link_style = link.style,
            link_border_color = '#e1e8ed';
        
        link_style.borderColor = link_border_color;
        
        add_event( link, 'mouseover', function ( event ) {
            link_border_color = link_style.borderColor;
            link_style.borderColor = 'red';
        } );
        
        add_event( link, 'mouseout', function ( event ) {
            link_style.borderColor = link_border_color;
        } );
        
        link.appendChild( doc.createTextNode( OPTIONS.DOWNLOAD_HELPER_BUTTON_TEXT ) );
        
        if ( img_url ) {
            var filename = get_media_filename( img_url );
            
            link.href = img_url;
            link.download = filename;
        }
        return link;
    }
    
    return create_download_link;
} )(); // end of create_download_link()


function save_blob( filename, blob ) {
    function _save() {
        var blob_url = URL.createObjectURL( blob ),
            download_button = d.createElement( 'a' );
        
        download_button.href = blob_url;
        download_button.download = filename;
        
        download_button.addEventListener( 'click', ( event ) => {
            event.stopPropagation(); // イベントハンドラ無効化
        } );
        
        d.documentElement.appendChild( download_button );
        
        download_button.click();
        // TODO: src を画像のURL(https://pbs.twimg.com/media/*)としたIFRAME 内では、なぜかダウンロードではなく、ページ遷移されてしまい、
        //   その上で、CSPエラーとなってしまう(Chrome 65.0.3325.162)
        //   Refused to frame '' because it violates the following Content Security Policy directive: "frame-src 'self' https://staticxx.facebook.com https://twitter.com https://*.twimg.com 
        //     https://5415703.fls.doubleclick.net https://player.vimeo.com https://pay.twitter.com https://www.facebook.com https://ton.twitter.com https://syndication.twitter.com 
        //     https://vine.co twitter: https://www.youtube.com https://platform.twitter.com https://upload.twitter.com https://s-static.ak.facebook.com https://4337974.fls.doubleclick.net 
        //     https://8122179.fls.doubleclick.net https://donate.twitter.com".
        
        download_button.parentNode.removeChild( download_button );
    } // end of _save()
    
    if ( ( typeof saveAs == 'function' ) && ( ! is_legacy_tweetdeck() ) ) {
        try {
            //window.saveAs( blob, filename ); // Firefoxでは saveAs は window 下に存在しない
            saveAs( blob, filename );
        }
        catch ( error ) {
            //log_error( error );
            _save();
        }
    }
    else {
        _save();
    }
} // end of save_blob()


function save_base64( filename, base64, mimetype ) {
    mimetype = ( mimetype ) ? mimetype : 'application/octet-stream';
    
    var data_url = 'data:' + mimetype + ';base64,' + base64,
        download_button = d.createElement( 'a' );
    
    download_button.href = data_url;
    download_button.download = filename;
    
    download_button.addEventListener( 'click', ( event ) => {
        event.stopPropagation(); // イベントハンドラ無効化
    } );
    
    d.documentElement.appendChild( download_button );
    
    download_button.click();
    
    download_button.parentNode.removeChild( download_button );
} // end of save_base64()


var create_gif_encoder = ( function () {
    // GIF89a エンコーダ
    // - フレーム毎にローカルカラーテーブル(メディアンカット・RGB各5bit)
    // - 前フレームから変化していない画素は透過(ファイルサイズ削減)
    var COLOR_KEY_NUMBER = 1 << 15,
        TRANSPARENT_INDEX = 255;
    
    function quantize( histogram, max_colors ) {
        var key_list = [],
            key_to_index = new Uint8Array( COLOR_KEY_NUMBER ),
            palette = [];
        
        for ( var key = 0; key < COLOR_KEY_NUMBER; key ++ ) {
            if ( histogram[ key ] ) {
                key_list.push( key );
            }
        }
        if ( key_list.length <= 0 ) {
            return { palette : palette, key_to_index : key_to_index };
        }
        
        function create_box( box_key_list ) {
            var count = 0,
                min_list = [ 31, 31, 31 ],
                max_list = [ 0, 0, 0 ];
            
            box_key_list.forEach( ( key ) => {
                var r = key >> 10,
                    g = ( key >> 5 ) & 31,
                    b = key & 31;
                
                count += histogram[ key ];
                if ( r < min_list[ 0 ] ) min_list[ 0 ] = r;
                if ( max_list[ 0 ] < r ) max_list[ 0 ] = r;
                if ( g < min_list[ 1 ] ) min_list[ 1 ] = g;
                if ( max_list[ 1 ] < g ) max_list[ 1 ] = g;
                if ( b < min_list[ 2 ] ) min_list[ 2 ] = b;
                if ( max_list[ 2 ] < b ) max_list[ 2 ] = b;
            } );
            
            var channel = [ 0, 1, 2 ].reduce( ( best, ci ) => ( ( ( max_list[ best ] - min_list[ best ] ) < ( max_list[ ci ] - min_list[ ci ] ) ) ? ci : best ), 0 );
            
            return {
                key_list : box_key_list,
                count : count,
                channel : channel,
                score : ( max_list[ channel ] - min_list[ channel ] ) * count,
            };
        } // end of create_box()
        
        var box_list = [ create_box( key_list ) ];
        
        while ( box_list.length < max_colors ) {
            var target_index = -1;
            
            box_list.forEach( ( box, index ) => {
                if ( ( box.key_list.length < 2 ) || ( box.score <= 0 ) ) {
                    return;
                }
                if ( ( target_index < 0 ) || ( box_list[ target_index ].score < box.score ) ) {
                    target_index = index;
                }
            } );
            if ( target_index < 0 ) {
                break;
            }
            
            var box = box_list[ target_index ],
                shift = [ 10, 5, 0 ][ box.channel ],
                sorted_key_list = box.key_list.slice( 0 ).sort( ( key1, key2 ) => ( ( key1 >> shift ) & 31 ) - ( ( key2 >> shift ) & 31 ) ),
                half_count = box.count / 2,
                total_count = 0,
                split_index = 1;
            
            for ( var ci = 0; ci < sorted_key_list.length - 1; ci ++ ) {
                total_count += histogram[ sorted_key_list[ ci ] ];
                split_index = ci + 1;
                if ( half_count <= total_count ) {
                    break;
                }
            }
            box_list.splice( target_index, 1, create_box( sorted_key_list.slice( 0, split_index ) ), create_box( sorted_key_list.slice( split_index ) ) );
        }
        
        box_list.forEach( ( box, index ) => {
            var sum_list = [ 0, 0, 0 ];
            
            box.key_list.forEach( ( key ) => {
                var count = histogram[ key ],
                    r = key >> 10,
                    g = ( key >> 5 ) & 31,
                    b = key & 31;
                
                sum_list[ 0 ] += ( ( r << 3 ) | ( r >> 2 ) ) * count;
                sum_list[ 1 ] += ( ( g << 3 ) | ( g >> 2 ) ) * count;
                sum_list[ 2 ] += ( ( b << 3 ) | ( b >> 2 ) ) * count;
                key_to_index[ key ] = index;
            } );
            palette.push( sum_list.map( ( sum ) => Math.round( sum / box.count ) ) );
        } );
        
        return { palette : palette, key_to_index : key_to_index };
    } // end of quantize()
    
    
    function create_gif_encoder( width, height ) {
        var chunk_list = [],
            byte_list = [],
            previous_key_list = null;
        
        function flush_bytes() {
            if ( byte_list.length <= 0 ) {
                return;
            }
            chunk_list.push( new Uint8Array( byte_list ) );
            byte_list = [];
        } // end of flush_bytes()
        
        function write_byte( value ) {
            byte_list.push( value & 0xff );
            if ( 65536 <= byte_list.length ) {
                flush_bytes();
            }
        } // end of write_byte()
        
        function write_short( value ) {
            write_byte( value );
            write_byte( value >> 8 );
        } // end of write_short()
        
        function write_string( text ) {
            for ( var ci = 0; ci < text.length; ci ++ ) {
                write_byte( text.charCodeAt( ci ) );
            }
        } // end of write_string()
        
        function write_lzw( index_list ) {
            var min_code_size = 8,
                clear_code = 1 << min_code_size,
                eoi_code = clear_code + 1,
                code_size = min_code_size + 1,
                next_code = eoi_code + 1,
                code_table = new Map(),
                bit_buffer = 0,
                bit_count = 0,
                block = new Uint8Array( 255 ),
                block_length = 0;
            
            function flush_block() {
                if ( block_length <= 0 ) {
                    return;
                }
                write_byte( block_length );
                for ( var ci = 0; ci < block_length; ci ++ ) {
                    write_byte( block[ ci ] );
                }
                block_length = 0;
            } // end of flush_block()
            
            function write_block_byte( value ) {
                block[ block_length ++ ] = value;
                if ( block_length == 255 ) {
                    flush_block();
                }
            } // end of write_block_byte()
            
            function emit_code( code ) {
                bit_buffer |= code << bit_count;
                bit_count += code_size;
                while ( 8 <= bit_count ) {
                    write_block_byte( bit_buffer & 0xff );
                    bit_buffer >>>= 8;
                    bit_count -= 8;
                }
            } // end of emit_code()
            
            write_byte( min_code_size );
            emit_code( clear_code );
            
            var current_code = index_list[ 0 ];
            
            for ( var ci = 1; ci < index_list.length; ci ++ ) {
                var index = index_list[ ci ],
                    key = ( current_code << 8 ) | index,
                    code = code_table.get( key );
                
                if ( code !== undefined ) {
                    current_code = code;
                    continue;
                }
                emit_code( current_code );
                
                if ( next_code == 4096 ) {
                    // テーブルが一杯になったらクリア
                    emit_code( clear_code );
                    code_table.clear();
                    next_code = eoi_code + 1;
                    code_size = min_code_size + 1;
                }
                else {
                    if ( ( 1 << code_size ) <= next_code ) {
                        code_size ++;
                    }
                    code_table.set( key, next_code ++ );
                }
                current_code = index;
            }
            emit_code( current_code );
            emit_code( eoi_code );
            
            if ( 0 < bit_count ) {
                write_block_byte( bit_buffer & 0xff );
            }
            flush_block();
            write_byte( 0 ); // Block Terminator
        } // end of write_lzw()
        
        
        function add_frame( rgba, delay_cs ) {
            var pixel_number = width * height,
                key_list = new Uint16Array( pixel_number ),
                index_list = new Uint8Array( pixel_number ),
                histogram = new Uint32Array( COLOR_KEY_NUMBER ),
                use_transparency = ( previous_key_list !== null ),
                ci,
                pi;
            
            for ( ci = 0, pi = 0; ci < pixel_number; ci ++, pi += 4 ) {
                var key = ( ( rgba[ pi ] >> 3 ) << 10 ) | ( ( rgba[ pi + 1 ] >> 3 ) << 5 ) | ( rgba[ pi + 2 ] >> 3 );
                
                key_list[ ci ] = key;
                if ( use_transparency && ( previous_key_list[ ci ] == key ) ) {
                    continue;
                }
                histogram[ key ] ++;
            }
            
            var quantized = quantize( histogram, ( use_transparency ) ? TRANSPARENT_INDEX : 256 ),
                palette = quantized.palette,
                key_to_index = quantized.key_to_index;
            
            for ( ci = 0; ci < pixel_number; ci ++ ) {
                index_list[ ci ] = ( use_transparency && ( previous_key_list[ ci ] == key_list[ ci ] ) ) ? TRANSPARENT_INDEX : key_to_index[ key_list[ ci ] ];
            }
            previous_key_list = key_list;
            
            // Graphic Control Extension (disposal method: 1 = do not dispose)
            write_byte( 0x21 );
            write_byte( 0xf9 );
            write_byte( 4 );
            write_byte( ( 1 << 2 ) | ( ( use_transparency ) ? 1 : 0 ) );
            write_short( delay_cs );
            write_byte( ( use_transparency ) ? TRANSPARENT_INDEX : 0 );
            write_byte( 0 );
            
            // Image Descriptor (with 256 colors Local Color Table)
            write_byte( 0x2c );
            write_short( 0 );
            write_short( 0 );
            write_short( width );
            write_short( height );
            write_byte( 0x80 | 7 );
            
            for ( ci = 0; ci < 256; ci ++ ) {
                var color = palette[ ci ] || [ 0, 0, 0 ];
                
                write_byte( color[ 0 ] );
                write_byte( color[ 1 ] );
                write_byte( color[ 2 ] );
            }
            
            write_lzw( index_list );
        } // end of add_frame()
        
        
        function finish() {
            write_byte( 0x3b ); // Trailer
            flush_bytes();
            return new Blob( chunk_list, { type : 'image/gif' } );
        } // end of finish()
        
        
        // Header + Logical Screen Descriptor (no Global Color Table)
        write_string( 'GIF89a' );
        write_short( width );
        write_short( height );
        write_byte( 0x70 );
        write_byte( 0 );
        write_byte( 0 );
        
        // Application Extension (NETSCAPE2.0: loop forever)
        write_byte( 0x21 );
        write_byte( 0xff );
        write_byte( 11 );
        write_string( 'NETSCAPE2.0' );
        write_byte( 3 );
        write_byte( 1 );
        write_short( 0 );
        write_byte( 0 );
        
        return {
            add_frame : add_frame,
            finish : finish,
        };
    } // end of create_gif_encoder()
    
    return create_gif_encoder;
} )(); // end of create_gif_encoder()


function convert_video_to_gif( video_blob, on_progress ) {
    // X の GIF は実体が MP4 のため、フレームを切り出して GIF に変換
    return new Promise( ( resolve, reject ) => {
        var video = d.createElement( 'video' ),
            blob_url = URL.createObjectURL( video_blob ),
            is_finished = false;
        
        function finish( error, gif_blob ) {
            if ( is_finished ) {
                return;
            }
            is_finished = true;
            video.removeAttribute( 'src' );
            video.load();
            URL.revokeObjectURL( blob_url );
            
            if ( error ) {
                reject( error );
            }
            else {
                resolve( gif_blob );
            }
        } // end of finish()
        
        function seek( time ) {
            return new Promise( ( resolve ) => {
                var timerid = setTimeout( on_seeked, 5000 );
                
                function on_seeked() {
                    clearTimeout( timerid );
                    video.removeEventListener( 'seeked', on_seeked );
                    resolve();
                }
                video.addEventListener( 'seeked', on_seeked );
                video.currentTime = time;
            } );
        } // end of seek()
        
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        
        video.addEventListener( 'error', ( event ) => {
            finish( new Error( 'video load error' ) );
        } );
        
        video.addEventListener( 'loadeddata', async ( event ) => {
            try {
                var width = video.videoWidth,
                    height = video.videoHeight,
                    duration = video.duration;
                
                if ( ! isFinite( duration ) ) {
                    // 長さ情報が無い場合は末尾までシークすると判明する
                    await seek( 1e9 );
                    duration = video.duration;
                }
                
                if ( ( ! width ) || ( ! height ) || ( ! isFinite( duration ) ) ) {
                    throw new Error( 'invalid video: ' + width + 'x' + height + ' ' + duration + 's' );
                }
                
                var frames_per_second = ( duration <= OPTIONS.GIF_LONG_DURATION_SEC ) ? OPTIONS.GIF_FRAMES_PER_SECOND : OPTIONS.GIF_FRAMES_PER_SECOND_LONG,
                    delay_cs = Math.round( 100 / frames_per_second ),
                    frame_total = Math.max( 1, Math.round( duration * frames_per_second ) ),
                    canvas = d.createElement( 'canvas' ),
                    context = canvas.getContext( '2d', { willReadFrequently : true } ),
                    encoder = create_gif_encoder( width, height );
                
                canvas.width = width;
                canvas.height = height;
                
                for ( var frame_index = 0; frame_index < frame_total; frame_index ++ ) {
                    await seek( Math.min( frame_index / frames_per_second, Math.max( 0, duration - 0.001 ) ) );
                    
                    context.drawImage( video, 0, 0, width, height );
                    encoder.add_frame( context.getImageData( 0, 0, width, height ).data, delay_cs );
                    
                    if ( typeof on_progress == 'function' ) {
                        on_progress( ( frame_index + 1 ) / frame_total );
                    }
                }
                finish( null, encoder.finish() );
            }
            catch ( error ) {
                finish( error );
            }
        }, { once : true } );
        
        video.src = blob_url;
    } );
} // end of convert_video_to_gif()


async function fetch_media_data( media_url, on_progress ) {
    // 戻り値: { blob, extension } (GIF は設定に応じて .gif に変換、失敗時は .mp4 のまま)
    var response = await fetch( media_url );
    
    if ( ! response.ok ) {
        throw new Error( response.status + ' ' + response.statusText );
    }
    
    var blob = await response.blob(),
        extension = ( is_video_url( media_url ) ) ? 'mp4' : get_img_extension( media_url );
    
    if ( ( get_media_type( media_url ) == 'animated_gif' ) && OPTIONS.DOWNLOAD_GIF_AS_GIF ) {
        try {
            blob = await convert_video_to_gif( blob, on_progress );
            extension = 'gif';
        }
        catch ( error ) {
            log_error( 'GIF conversion failure (saved as mp4):', media_url, error );
        }
    }
    return {
        blob : blob,
        extension : extension,
    };
} // end of fetch_media_data()


async function save_media_file( media_url, filename, on_progress, prefer_background_download ) {
    var media_type = get_media_type( media_url ),
        media_data;
    
    if ( ( media_type == 'animated_gif' ) && OPTIONS.DOWNLOAD_GIF_AS_GIF ) {
        media_data = await fetch_media_data( media_url, on_progress );
        save_blob( filename.replace( /\.\w+$/, '' ) + '.' + media_data.extension, media_data.blob );
        return;
    }
    
    if ( ( prefer_background_download || ( media_type != 'photo' ) ) && ( typeof w.extension_functions?.download_url == 'function' ) ) {
        // 拡張機能の場合は chrome.downloads で保存(大きな動画をメモリに載せない・複数ファイルの確認ダイアログを回避)
        try {
            await w.extension_functions.download_url( media_url, filename );
            return;
        }
        catch ( error ) {
            log_error( 'download_url() failure:', media_url, filename, error );
        }
    }
    
    media_data = await fetch_media_data( media_url );
    save_blob( filename, media_data.blob );
} // end of save_media_file()


function get_filename_prefix( tweet_url ) {
    return tweet_url.replace( /^https?:\/\/(?:mobile\.)?x\.com\/([^\/]+)\/status(?:es)?\/(\d+).*$/, '$1-$2' ); //twitter
} // end of get_filename_prefix()


function get_media_text( media_list, media_urls ) {
    return ( media_list.length < 1 ) ? media_urls.join( '\n' ) : media_list.map( ( media_info ) => {
        const
            text_list = [ media_info.media_url_https ],
            video_url = get_best_video_url( media_info ),
            media_alt_text = media_info.ext_alt_text;
        if ( video_url ) {
            text_list.push( video_url );
        }
        if ( media_alt_text ) {
            text_list.push( `[Alt]\n${media_alt_text}\n` );
        }
        return text_list.join( '\n' );
    } ).join( '\n' );
} // end of get_media_text()


function get_tweet_info_text( tweet_url, fullname, username, datetime_string, title, quoted_tweet_url, media_text ) {
    return [
        tweet_url,
        `${fullname}\n@${username}\n${datetime_string}`,
        title + ( quoted_tweet_url ? `\n\n${quoted_tweet_url}` : '' ),
        media_text,
    ].join( `\n${'-'.repeat(80)}\n` ) + '\n';
} // end of get_tweet_info_text()


function download_zip( tweet_info_json ) {
    var tweet_info,
        tweet_url,
        title,
        fullname,
        username,
        timestamp_ms,
        img_urls;
    
    try {
        tweet_info = JSON.parse( tweet_info_json );
        tweet_url = tweet_info.url;
        title = ( tweet_info.title ) ? tweet_info.title : '';
        fullname = tweet_info.fullname.trim();
        username = tweet_info.username.trim();
        timestamp_ms = tweet_info.timestamp_ms;
        img_urls = tweet_info.img_urls;
        
        tweet_url = /^http/.test( tweet_url ) ? tweet_url : 'https://x.com' + tweet_url; // twitter
        
        if ( ( ! tweet_url ) || ( ! img_urls ) || ( img_urls.length <= 0 ) ) {
            return false;
        }
    }
    catch ( error ) {
        return false;
    }
    
    var zip = new JSZip(),
        filename_prefix = get_filename_prefix(tweet_url);
    
    timestamp_ms = ( timestamp_ms ) ? timestamp_ms : get_timestamp_ms_from_tweet_url( tweet_url );
    
    var date = new Date( parseInt( timestamp_ms, 10 ) ),
        zipdate = adjust_date_for_zip( date ),
        datetime_string = get_datetime_string_from_timestamp_ms( timestamp_ms ),
        img_info_dict = {};
    
    if ( filename_prefix == tweet_url ) {
        return false;
    }
    
    zip.file( filename_prefix + '.url', '[InternetShortcut]\nURL=' + tweet_url + '\n', {
        date : zipdate
    } );
    
    var tweet_id = get_tweet_id_from_tweet_url( tweet_url ),
        callback = ( result, is_error ) => {
            if ( ! is_error ) {
                try {
                    fullname = result.user.name;
                    username = result.user.screen_name;
                    title = result.full_text || result.text;
                    datetime_string = get_datetime_string_from_timestamp_ms( new Date( result.created_at ).getTime() );
                }
                catch ( error ) {
                    log_error( 'download_zip() callback() error:', error );
                }
            }
            
            if ( fullname && username ) {
                var media_list = ( result?.media_list || [] );
                if ( ( result.quoted_tweet_id ) && ( typeof window?.extension_functions?.get_tweet_info == 'function' ) ) {
                    const
                        quoted_tweet_info = extension_functions.get_tweet_info( result.quoted_tweet_id );
                    
                    media_list = media_list.concat( quoted_tweet_info?.media_list || [] );
                }
                var media_text = get_media_text( media_list, img_urls ),
                    tweet_info_text = get_tweet_info_text( tweet_url, fullname, username, datetime_string, title, result?.quoted_tweet_url, media_text );
                
                zip.file( filename_prefix + '.txt', tweet_info_text, {
                    date : zipdate
                } );
            }
            
            function add_img_info( img_url, arrayBuffer, extension ) {
                var img_info = {
                        filename : get_img_filename( img_url )
                    ,   arrayBuffer : ( arrayBuffer ) ? arrayBuffer : ''
                    ,   extension : extension
                    };
                
                img_info_dict[ img_url ] = img_info;
                
                if ( Object.keys( img_info_dict ).length < img_urls.length ) {
                    return;
                }
                
                img_urls.forEach( function ( img_url, index ) {
                    var img_info = img_info_dict[ img_url ],
                        img_extension = img_info.extension || get_img_extension( img_info.filename ),
                        //img_filename = img_info.filename;
                        img_filename = get_zip_media_filename( filename_prefix, img_url, index, img_extension );
                    
                    if ( ! img_extension ) {
                        return;
                    }
                    zip.file( img_filename, img_info.arrayBuffer, {
                        date : zipdate
                    } );
                } );
                
                var zip_content_type = ( is_firefox() ) ? 'base64' : 'blob';
                    // ※ JSZip 自体は 'base64' 等もサポートしている [generateAsync(options[, onUpdate])](https://stuk.github.io/jszip/documentation/api_jszip/generate_async.html)
                    // ※ 'base64' の場合、'data:application/zip;base64,' + zip_content でデータ URL を作成できるが、これでダウンロードすると、 Chrome ではセキュリティの警告が出て削除されてしまう
                    
                    // TODO: ZIP を保存しようとすると、Firefox でセキュリティ警告が出る場合がある（「このファイルを開くのは危険です」(This file is not commonly downloaded.)）
                    // → Firefox のみ、Blob URL ではなく、Data URL(Base64) で様子見
                
                zip.generateAsync( { type : zip_content_type } ).then( function ( zip_content ) {
                    var zip_filename = filename_prefix + '.zip';
                    
                    if ( zip_content_type == 'base64' ) {
                        save_base64( zip_filename, zip_content );
                    }
                    else {
                        save_blob( zip_filename, zip_content );
                    }
                    
                    if ( w.opener && ( w === top ) && ( /^https?:\/\/pbs\.twimg\.com\/media\//.test( w.location.href ) ) ) {
                        // ダウンロード用に開かれた window を閉じる
                        setTimeout( function () {
                            w.close();
                        }, 1000 );
                    }
                } ).catch( ( error ) => {
                    log_error( 'add_img_info() zip.generateAsync()', error );
                } );
            } // end of add_img_info()
            
            
            img_urls.forEach( function ( img_url ) {
                if ( is_video_url( img_url ) ) {
                    // 動画・GIF (GIF は設定により .gif に変換)
                    fetch_media_data( img_url )
                    .then( ( media_data ) => media_data.blob.arrayBuffer().then( ( arrayBuffer ) => add_img_info( img_url, arrayBuffer, media_data.extension ) ) )
                    .catch( ( error ) => {
                        log_error( 'download_zip() fetch_media_data() error:', img_url, error );
                        add_img_info( img_url, null, get_media_extension( img_url ) );
                    } );
                    return;
                }
                if ( ( ! is_media_url( img_url ) ) || ( img_url == get_img_filename( img_url ) ) ) {
                    return;
                }
                
                if ( typeof GM_xmlhttpRequest == 'function' ) { // [2021/11]メモ: ユーザースクリプトとして動作時、XMLHttpRequestではTweetDeckでダウンロードできなくなったため、is_firefox()の条件をはずす
                    GM_xmlhttpRequest( {
                        method : 'GET'
                    ,   url : img_url
                    ,   responseType : 'arraybuffer'
                    ,   onload : function ( response ) {
                            add_img_info( img_url, response.response );
                        }
                    ,   onerror : function ( response ) {
                            log_error( response.status, response.statusText );
                            add_img_info( img_url );
                        }
                    } );
                }
                else {
                    var xhr = new XMLHttpRequest();
                    
                    xhr.open( 'GET', img_url, true );
                    xhr.responseType = 'arraybuffer';
                    xhr.onload = function () {
                        if ( xhr.readyState != 4 ) {
                            return;
                        }
                        if ( xhr.status != 200 ) {
                            log_error( xhr.status, xhr.statusText );
                            return;
                        }
                        add_img_info( img_url, xhr.response );
                    };
                    xhr.onerror = function () {
                        log_error( xhr.status, xhr.statusText );
                        add_img_info( img_url );
                    };
                    xhr.send();
                }
            } );
            
        };
    
    if ( typeof window?.extension_functions?.async_get_tweet_info == 'function' ) {
        ( async () => {
            const
                result = await extension_functions.async_get_tweet_info( tweet_id );
            
            if ( result ) {
                callback( result, false );
            }
            else {
                /*
                //const
                //    error_message = 'download_zip() extension_functions.async_get_tweet_info() failure';
                //callback( {
                //    error_message,
                //}, true );
                */
                /*
                //fetch_status( tweet_id )
                //.then( result => {
                //    callback( result, false );
                //} )
                //.catch( error => {
                //    log_error( 'download_zip() fetch_status() error:', error );
                //    callback( error, true );
                //} );
                */
                log_warn( 'download_zip() extension_functions.async_get_tweet_info() failure' );
                try {
                    const
                        result = await fetch_status_json( tweet_id );
                    callback( result, false );
                }
                catch ( error ) {
                    log_error( 'download_zip() fetch_status_json() error:', error );
                    callback( error, true );
                }
            }
        } )();
    }
    else {
        /*
        //fetch_status( tweet_id )
        //.then( result => {
        //    callback( result, false );
        //} )
        //.catch( error => {
        //    log_error( 'download_zip() fetch_status() error:', error );
        //    callback( error, true );
        //} );
        */
        ( async () => {
            try {
                const
                    result = await fetch_status_json( tweet_id );
                callback( result, false );
            }
            catch ( error ) {
                log_error( 'download_zip() fetch_status_json() error:', error );
                callback( error, true );
            }
        } )();
    }
    return true;
} // end of download_zip()


function initialize_download_helper() {
    if ( ! is_media_url() ) {
        return false;
    }
    
    if ( ! OPTIONS.DOWNLOAD_HELPER_SCRIPT_IS_VALID ) {
        return true;
    }
    
    var img_url = w.location.href,
        img_referrer = d.referrer,
        is_child = /^https?:\/\/(?:pro\.|mobile\.)?x\.com\//.test( img_referrer ), // twitter
        link = ( is_ie() ) ? null : create_download_link( img_url );
    
    if ( link && is_child ) {
        // TODO: 第三者のサイト上であっても、window.name にフォーマットにあった値を設定されてしまうと、指定通りに保存されてしまう
        // →暫定的に、referrer 確認で対処
        
        if (
            ( is_edge() && ( w.parent !== w ) ) ||
            // TODO: MS-Edge ＋ Tampermonkey の場合、IFRAME 経由で呼び出すと、window.name の値が読めない
            // → やむを得ず、IFRAME からの呼び出しであることのみチェック
            (  w.name == SCRIPT_NAME + '_download_frame' )
        ) {
            // 本スクリプトによりダウンロード用 IFRAME 経由で開いた場合
            d.documentElement.appendChild( link );
            
            link.click(); // ダウンロード開始
            
            link.parentNode.removeChild( link );
            
            return true;
        }
        
        try {
            var tweet_info_json = decodeURIComponent( w.name );
            
            if ( is_child && download_zip( tweet_info_json ) ) {
                return true;
            }
        }
        catch ( error ) {
            //log_error( error );
        }
    }
    
    if ( d.querySelector( 'form.search-404' ) ) {
        var current_extension = get_img_extension( img_url );
        
        if ( ! current_extension ) {
            return;
        }
        
        /*
        //extension_list.forEach( function( extension ) {
        //    if ( current_extension == extension ) {
        //        return;
        //    }
        //    var try_img = new Image(),
        //        try_url = img_url.replace( '.' + current_extension, '.' + extension );
        //    
        //    add_event( try_img, 'load', function ( event ) {
        //        w.location.replace( try_url );
        //    } );
        //    
        //    try {
        //        try_img.src = try_url;
        //    }
        //    catch ( error ) {
        //        //log_error( error );
        //        // TODO: Firefox だとうまくいかない
        //        // Content Security Policy: ページの設定により次のリソースの読み込みをブロックしました: (try_url) ("img-src https://abs.twimg.com https://ssl.google-analytics.com http://www.google-analytics.com")
        //    }
        //} );
        */
        
        ( async () => {
            const
                valid_img_url = await find_valid_img_url( img_url );
            
            if ( valid_img_url != img_url ) {
                w.location.replace( valid_img_url );
            }
        } );
        return;
    }
    
    // ※ 以下、通常の window(top) として開いた場合、もしくは本スクリプトにより window.open() で開いた場合
    
    if ( ( ! img_referrer ) || ( get_img_url( img_url ) !== get_img_url( img_referrer ) ) ) {
        // 画像単体で開いた場合、もしくは画像以外のページからの遷移時→デフォルトで原寸画像(:orig)を開く
        let
            orig_url = get_img_url( img_url, 'orig' );
        
        if ( img_url != orig_url ) {
            const
                current_extension = get_img_extension( img_url );
            
            if ( ! current_extension ) {
                return;
            }
            ( async () => {
                const
                    valid_img_url = await find_valid_img_url( orig_url );
                w.location.replace( valid_img_url );
            } )();
            return;
        }
    }
    
    var link_container = d.createElement( 'div' ),
        link_container_style = link_container.style,
        kind_list = [ 'thumb', 'small', '900x900', 'medium', 'large', 'orig' ],
        current_kind = get_img_kind( img_url ),
        fadeout = true,
        initial_fadeout_limit_msec = 1500,
        default_fadeout_limit_msec = 500,
        fadeout_unit_msec = 100,
        timerid = null,
        fadeout_later_timerid = null;
        
    
    link_container_style.position = 'fixed';
    link_container_style.top = 0;
    link_container_style.left = 0;
    link_container_style.zIndex = 10000;
    link_container_style.width = '100%';
    //link_container_style.margin = '2px 0 1px 0';
    link_container_style.margin = '0 0 0 0';
    link_container_style.fontFamily = FONT_FAMILY;
    link_container_style.padding = '2px 4px';
    link_container_style.opacity = '1.0';
    link_container_style.background = 'lightyellow';
    link_container_style.border = 'solid 1px silver';
    
    if ( link ) {
        link.style.marginRight = '6px';
        link_container.appendChild( link );
        
        add_event( d.body, 'keydown', function ( event ) {
            var key_code = event.keyCode;
            
            if ( event.ctrlKey || event.altKey || event.shiftKey ) {
                return false;
            }
            
            switch ( key_code ) {
                case 68 : // [d]
                    link.click(); // ダウンロード開始
                    break;
            }
        } );
    }
    
    kind_list.forEach( function ( kind ) {
        var kind_link = d.createElement( 'a' ),
            kind_link_style = kind_link.style;
        
        if ( kind == current_kind ) {
            kind_link_style.color = 'olive';
        }
        else {
            kind_link.href = get_img_url( img_url, kind );
        }
        kind_link_style.fontSize = '14px';
        kind_link_style.fontWeight = 'bolder';
        kind_link_style.background = 'white';
        kind_link_style.margin = '0 2px';
        kind_link_style.padding = '2px 4px';
        kind_link.appendChild( d.createTextNode( kind ) );
        
        link_container.appendChild( kind_link );
    } );
    
    
    function clear_fadeout_later_timer() {
        if ( ! fadeout_later_timerid ) {
            return;
        }
        
        clearTimeout( fadeout_later_timerid );
        fadeout_later_timerid = null;
    } // end of clear_fadeout_later_timer()
    
    
    function start_fadeout( fadeout_limit_msec ) {
        function clear_timer() {
            if ( ! timerid ) {
                return;
            }
            
            clearInterval( timerid );
            timerid = null;
        } // end of clear_timer()
        
        
        if ( ! fadeout_limit_msec ) {
            fadeout_limit_msec = default_fadeout_limit_msec;
        }
        
        clear_timer();
        fadeout = true;
        link_container_style.opacity = '1.0';
        
        var current_msec = fadeout_limit_msec;
        
        timerid = setInterval( function () {
            if ( ! fadeout ) {
                clear_timer();
                return;
            }
            current_msec -= fadeout_unit_msec;
            
            if ( current_msec <= 0 ) {
                clear_timer();
                link_container_style.opacity = '0.0';
                fadeout = false;
                return;
            }
            
            if ( current_msec < default_fadeout_limit_msec ) {
                link_container_style.opacity = current_msec / default_fadeout_limit_msec;
            }
        }, fadeout_unit_msec );
        
    } // end of start_fadeout()
    
    add_event( link_container, 'mouseover', function ( event ) {
        event.stopPropagation();
        clear_fadeout_later_timer();
        fadeout = false;
        link_container_style.opacity = '1.0';
    } );
    
    add_event( link_container, 'mousemove', function ( event ) {
        event.stopPropagation();
        clear_fadeout_later_timer();
        fadeout = false;
        link_container_style.opacity = '1.0';
    } );
    
    add_event( link_container, 'mouseout', function ( event ) {
        clear_fadeout_later_timer();
        fadeout_later_timerid = setTimeout( function() {
            start_fadeout();
        }, 300 );
    } );
    
    start_fadeout( initial_fadeout_limit_msec );
    
    d.body.insertBefore( link_container, d.body.firstChild );
    
    return true;
} // end of initialize_download_helper()


function initialize( user_options ) {
    if ( user_options ) {
        Object.keys( user_options ).forEach( function ( name ) {
            if ( user_options[ name ] === null ) {
                return;
            }
            OPTIONS[ name ] = user_options[ name ];
        } );
    }
    
    if ( ! OPTIONS.OPERATION ) {
        return;
    }
    
    if ( is_tweetdeck() && ( ! OPTIONS.ENABLED_ON_TWEETDECK ) ) {
        return;
    }
    
    if ( is_ie() || is_bookmarklet() ) {
        OPTIONS.DOWNLOAD_HELPER_SCRIPT_IS_VALID = false;
    }
    
    if ( ( typeof JSZip != 'function' ) || is_arraybuffer_bug() ) {
        OPTIONS.DOWNLOAD_ZIP_IS_VALID = false;
    }
    
    if ( initialize_download_helper() !== false ) {
        return;
    }
    
    if ( w !== parent ) {
        return;
    }
    
    function is_valid_url( url ) {
        if ( ! url ) {
            url = w.location.href;
        }
        
        if ( url.match( /\/([^/]+)\/status(?:es)?\/(\d+)/ ) ) {
            // 個別ページ
            if ( ! OPTIONS.SHOW_IN_DETAIL_PAGE ) {
                return false;
            }
        }
        else {
            // タイムライン
            if ( ! OPTIONS.SHOW_IN_TIMELINE ) {
                return false;
            }
        }
        return true;
    } // end of is_valid_url()
    
    
    var bulk_download = ( function () {
        // 複数の投稿を選択して一括ダウンロード(個別ファイル / ZIP)
        var select_button_classname = SCRIPT_NAME + '_bulk_select',
            selected_post_info_map = new Map(),
            is_running = false,
            bulk_bar = null,
            count_text = null,
            status_text = null;
        
        
        function update_select_button( select_button ) {
            var is_selected = selected_post_info_map.has( select_button.getAttribute( 'data-tweet-id' ) );
            
            select_button.textContent = ( is_selected ) ? '☑︎' : '☐';
            select_button.setAttribute( 'aria-pressed', ( is_selected ) ? 'true' : 'false' );
        } // end of update_select_button()
        
        
        function create_bar_link( text, on_click ) {
            // ダウンロードヘルパーのリンクと同じスタイル
            var link = create_download_link();
            
            clear_node( link );
            link.appendChild( d.createTextNode( text ) );
            link.style.cursor = 'pointer';
            
            add_event( link, 'click', function ( event ) {
                event.stopPropagation();
                event.preventDefault();
                
                if ( ! is_running ) {
                    on_click();
                }
                return false;
            } );
            
            return link;
        } // end of create_bar_link()
        
        
        function get_bulk_bar() {
            if ( bulk_bar ) {
                return bulk_bar;
            }
            
            // ダウンロードヘルパーのバーと同じスタイル(画面下部に固定)
            bulk_bar = d.createElement( 'div' );
            
            var bulk_bar_style = bulk_bar.style;
            
            bulk_bar.id = SCRIPT_NAME + '_bulk_download_bar';
            bulk_bar_style.display = 'none';
            bulk_bar_style.position = 'fixed';
            bulk_bar_style.bottom = 0;
            bulk_bar_style.left = 0;
            bulk_bar_style.zIndex = 9999; // オーバーレイ表示時はその下
            bulk_bar_style.width = '100%';
            bulk_bar_style.boxSizing = 'border-box';
            bulk_bar_style.margin = '0 0 0 0';
            bulk_bar_style.fontFamily = FONT_FAMILY;
            bulk_bar_style.fontSize = '14px';
            bulk_bar_style.color = 'black';
            bulk_bar_style.padding = '2px 4px';
            bulk_bar_style.background = 'lightyellow';
            bulk_bar_style.border = 'solid 1px silver';
            
            count_text = d.createElement( 'span' );
            status_text = d.createElement( 'span' );
            status_text.style.marginLeft = '8px';
            
            bulk_bar.appendChild( count_text );
            bulk_bar.appendChild( create_bar_link( OPTIONS.DOWNLOAD_HELPER_BUTTON_TEXT, () => run( false ) ) );
            if ( OPTIONS.DOWNLOAD_ZIP_IS_VALID ) {
                bulk_bar.appendChild( create_bar_link( OPTIONS.BULK_DOWNLOAD_ZIP_TEXT, () => run( true ) ) );
            }
            bulk_bar.appendChild( create_bar_link( OPTIONS.BULK_CLEAR_TEXT, clear ) );
            bulk_bar.appendChild( status_text );
            
            d.body.appendChild( bulk_bar );
            
            return bulk_bar;
        } // end of get_bulk_bar()
        
        
        function update_bar() {
            var bar = get_bulk_bar();
            
            clear_node( count_text );
            count_text.appendChild( d.createTextNode( OPTIONS.BULK_SELECTED_COUNT + selected_post_info_map.size ) );
            bar.style.display = ( ( 0 < selected_post_info_map.size ) || is_running ) ? 'block' : 'none';
        } // end of update_bar()
        
        
        function set_status( text ) {
            get_bulk_bar();
            clear_node( status_text );
            status_text.appendChild( d.createTextNode( text ) );
        } // end of set_status()
        
        
        function update_all() {
            to_array( d.querySelectorAll( 'button.' + select_button_classname ) ).forEach( update_select_button );
            update_bar();
        } // end of update_all()
        
        
        function clear() {
            selected_post_info_map.clear();
            set_status( '' );
            update_all();
        } // end of clear()
        
        
        function bind_select_button( select_button, tweet_id, get_post_info ) {
            select_button.classList.add( select_button_classname );
            select_button.setAttribute( 'data-tweet-id', tweet_id );
            select_button.title = OPTIONS.BULK_SELECT_HELP;
            
            update_select_button( select_button );
            
            add_event( select_button, 'click', function ( event ) {
                event.stopPropagation();
                event.preventDefault();
                
                if ( selected_post_info_map.has( tweet_id ) ) {
                    selected_post_info_map.delete( tweet_id );
                }
                else {
                    selected_post_info_map.set( tweet_id, get_post_info() );
                }
                if ( ! is_running ) {
                    set_status( '' );
                }
                update_all();
                
                return false;
            } );
        } // end of bind_select_button()
        
        
        async function get_post_media( post_info ) {
            // 動画を含む場合や API の情報が取得済みの場合は API から、それ以外はタイムライン上の画像から
            var media_urls = null,
                gif_urls = post_info.gif_urls;
            
            if ( ( 0 < post_info.video_number ) || ( typeof w.extension_functions?.get_tweet_info == 'function' && w.extension_functions.get_tweet_info( post_info.tweet_id ) ) ) {
                media_urls = await get_tweet_media_urls( post_info.tweet_id, OPTIONS.SHOW_IMAGES_OF_QUOTE_TWEET );
            }
            if ( media_urls && ( 0 < media_urls.length ) ) {
                return {
                    media_urls : media_urls,
                    is_incomplete : false,
                };
            }
            
            media_urls = [];
            for ( const img_url of post_info.img_urls ) {
                media_urls.push( await find_valid_img_url( img_url ) );
            }
            return {
                media_urls : media_urls.concat( gif_urls ),
                is_incomplete : ( gif_urls.length < post_info.video_number ), // 動画の URL が不明
            };
        } // end of get_post_media()
        
        
        function add_post_info_to_zip( zip, post_info, filename_prefix, zipdate ) {
            var tweet_url = post_info.tweet_url,
                tweet_info = ( typeof w.extension_functions?.get_tweet_info == 'function' ) ? w.extension_functions.get_tweet_info( post_info.tweet_id ) : null,
                media_list = ( tweet_info?.media_list || [] ),
                timestamp_ms = ( tweet_info?.created_at ) ? new Date( tweet_info.created_at ).getTime() : ( post_info.timestamp_ms || get_timestamp_ms_from_tweet_url( tweet_url ) );
            
            if ( tweet_info?.quoted_tweet_id && OPTIONS.SHOW_IMAGES_OF_QUOTE_TWEET ) {
                media_list = media_list.concat( w.extension_functions.get_tweet_info( tweet_info.quoted_tweet_id )?.media_list || [] );
            }
            
            zip.file( filename_prefix + '.url', '[InternetShortcut]\nURL=' + tweet_url + '\n', {
                date : zipdate
            } );
            
            zip.file( filename_prefix + '.txt', get_tweet_info_text(
                tweet_url,
                tweet_info?.user?.name || post_info.fullname,
                tweet_info?.user?.screen_name || post_info.username,
                get_datetime_string_from_timestamp_ms( timestamp_ms ),
                tweet_info?.full_text || post_info.title,
                tweet_info?.quoted_tweet_url,
                get_media_text( media_list, post_info.media_urls )
            ), {
                date : zipdate
            } );
        } // end of add_post_info_to_zip()
        
        
        function get_zipdate( post_info ) {
            var tweet_info = ( typeof w.extension_functions?.get_tweet_info == 'function' ) ? w.extension_functions.get_tweet_info( post_info.tweet_id ) : null,
                timestamp_ms = ( tweet_info?.created_at ) ? new Date( tweet_info.created_at ).getTime() : parseInt( post_info.timestamp_ms || get_timestamp_ms_from_tweet_url( post_info.tweet_url ), 10 ),
                date = new Date( timestamp_ms );
            
            return adjust_date_for_zip( isNaN( date.getTime() ) ? new Date() : date );
        } // end of get_zipdate()
        
        
        function get_zip_filename() {
            var now = new Date(),
                pad = ( value ) => ( '0' + value ).slice( -2 );
            
            return 'x-bulk-' + now.getFullYear() + pad( now.getMonth() + 1 ) + pad( now.getDate() ) + '-' + pad( now.getHours() ) + pad( now.getMinutes() ) + pad( now.getSeconds() ) + '.zip';
        } // end of get_zip_filename()
        
        
        async function run( use_zip ) {
            if ( is_running || ( selected_post_info_map.size <= 0 ) ) {
                return;
            }
            is_running = true;
            update_bar();
            
            var post_info_list = Array.from( selected_post_info_map.values() ),
                zip = ( use_zip ) ? new JSZip() : null,
                file_total = 0,
                file_count = 0,
                failure_count = 0;
            
            try {
                for ( let ci = 0; ci < post_info_list.length; ci ++ ) {
                    set_status( OPTIONS.BULK_PREPARING_TEXT + ' ' + ( ci + 1 ) + ' / ' + post_info_list.length );
                    
                    const
                        post_info = post_info_list[ ci ],
                        post_media = await get_post_media( post_info );
                    
                    post_info.media_urls = post_media.media_urls;
                    file_total += post_info.media_urls.length;
                    if ( post_media.is_incomplete ) {
                        log_warn( 'bulk download: video URL not found', post_info.tweet_url );
                        failure_count ++;
                    }
                }
                
                for ( const post_info of post_info_list ) {
                    const
                        filename_prefix = get_filename_prefix( post_info.tweet_url ),
                        zipdate = get_zipdate( post_info );
                    
                    if ( zip ) {
                        add_post_info_to_zip( zip, post_info, filename_prefix, zipdate );
                    }
                    
                    for ( let index = 0; index < post_info.media_urls.length; index ++ ) {
                        const
                            media_url = post_info.media_urls[ index ],
                            progress_text = OPTIONS.BULK_DOWNLOADING_TEXT + ' ' + ( file_count + 1 ) + ' / ' + file_total,
                            on_progress = ( ratio ) => set_status( progress_text + ' (' + OPTIONS.GIF_CONVERTING_TEXT + ' ' + Math.floor( ratio * 100 ) + '%)' );
                        
                        set_status( progress_text );
                        
                        try {
                            if ( zip ) {
                                const
                                    media_data = await fetch_media_data( media_url, on_progress );
                                
                                zip.file( get_zip_media_filename( filename_prefix, media_url, index, media_data.extension ), await media_data.blob.arrayBuffer(), {
                                    date : zipdate
                                } );
                            }
                            else {
                                await save_media_file( media_url, ( OPTIONS.SAME_FILENAME_AS_IN_ZIP ) ? get_zip_media_filename( filename_prefix, media_url, index ) : get_media_filename( media_url ), on_progress, true );
                            }
                        }
                        catch ( error ) {
                            log_error( 'bulk download failure:', media_url, error );
                            failure_count ++;
                        }
                        file_count ++;
                    }
                }
                
                if ( zip ) {
                    set_status( OPTIONS.BULK_ZIPPING_TEXT );
                    
                    var zip_content_type = ( is_firefox() ) ? 'base64' : 'blob', // download_zip() と同様
                        zip_content = await zip.generateAsync( { type : zip_content_type } ),
                        zip_filename = get_zip_filename();
                    
                    if ( zip_content_type == 'base64' ) {
                        save_base64( zip_filename, zip_content );
                    }
                    else {
                        save_blob( zip_filename, zip_content );
                    }
                }
                
                set_status( OPTIONS.BULK_DONE_TEXT + ' (' + file_total + ')' + ( ( 0 < failure_count ) ? ( ', ' + failure_count + ' ' + OPTIONS.BULK_FAILED_TEXT ) : '' ) );
            }
            catch ( error ) {
                log_error( 'bulk download error:', error );
                set_status( OPTIONS.BULK_FAILED_TEXT );
            }
            finally {
                is_running = false;
                update_bar();
            }
        } // end of run()
        
        
        return {
            bind_select_button : bind_select_button,
        };
    } )(); // end of bulk_download
    
    
    var add_open_button = ( function () {
        var button_container_classname = SCRIPT_NAME + 'Button',
            opened_name_map = {},
            top_offset = 26,
            
            MouseClick = {
                move_count : 0
            ,   fullscreen_container_width_scrollbar : null
            ,   element : null
            ,   start_mouse_position : { x : 0, y : 0 }
            
            
            ,   init : function ( element, fullscreen_container_width_scrollbar ) {
                    var self = this;
                    
                    self.element = element;
                    self.fullscreen_container_width_scrollbar = fullscreen_container_width_scrollbar;
                    
                    return self;
                } // end of init()
            
            
            ,   start : function ( click_function ) {
                    var self = this,
                        element = self.element;
                    
                    self.click_function = click_function;
                    
                    self._add_event( element, 'click', self._click, true );
                    self._add_event( element, 'mousedown', self._mousedown, true );
                    self._add_event( element, 'mousemove', self._mousemove, true );
                    self._add_event( element, 'mouseup', self._mouseup, true );
                    self._add_event( element, 'MouseClick', self._do_click_function, true );
                    
                    return self;
                } // end of start()
            
            
            ,   stop : function () {
                    var self = this,
                        element = self.element;
                    
                    self._remove_event( element, 'MouseClick' );
                    self._remove_event( element, 'mouseup' );
                    self._remove_event( element, 'mousemove' );
                    self._remove_event( element, 'mousedown' );
                    self._remove_event( element, 'click' );
                    
                    return self;
                } // end of start()
            
            
            ,   _add_event : function ( target, event_name, event_function ) {
                    var self = this;
                    
                    add_event.apply( self, arguments );
                } // end of _add_event()
            
            
            ,   _remove_event : function ( target, event_name, event_function ) {
                    var self = this;
                    
                    remove_event.apply( self, arguments );
                } // end of _remove_event()
            
            
            ,   _mouse_is_on_scrollbar : function ( event ) {
                    var self = this,
                        fullscreen_container_width_scrollbar = self.fullscreen_container_width_scrollbar;
                    
                    if ( ! fullscreen_container_width_scrollbar ) {
                        return false;
                    }
                    
                    var mouse_x = event.clientX,
                        mouse_y = event.clientY,
                        max_x = fullscreen_container_width_scrollbar.clientWidth,
                        max_y = fullscreen_container_width_scrollbar.clientHeight;
                    
                    if ( ( mouse_x < 0 || max_x <= mouse_x ) || ( mouse_y < 0 || max_y <= mouse_y ) ) {
                        return true;
                    }
                    
                    return false;
                } // end of _mouse_is_on_scrollbar()
            
            
            ,   _do_click_function : function ( event ) {
                    var self = this;
                    
                    if ( typeof self.click_function == 'function' ) {
                        self.click_function.apply( self, arguments );
                    }
                }
            
            ,   _click : function ( event ) {
                    var self = this;
                    
                    // デフォルトのクリックイベントは無効化
                    event.stopPropagation();
                    event.preventDefault();
                }
            
            
            ,   _mousedown : function ( event ) {
                    var self = this;
                    
                    self.move_count = 0;
                    self.start_mouse_position = get_mouse_position( event );
                } // end of _mousedown()
            
            
            ,   _mousemove : function ( event ) {
                    var self = this;
                    
                    self.move_count ++;
                } // end of _mousemove()
            
            
            ,   _mouseup : function ( event ) {
                    var self = this,
                        start_mouse_position = self.start_mouse_position;
                    
                    if ( event.button != 0 ) {
                        // メインボタン以外
                        return false;
                    }
                    
                    if ( self._mouse_is_on_scrollbar( event ) ) {
                        return false;
                    }
                    
                    var stop_mouse_position = get_mouse_position( event );
                    
                    if ( 10 < Math.max( Math.abs( stop_mouse_position.x - start_mouse_position.x ), Math.abs( stop_mouse_position.y - start_mouse_position.y ) ) ) {
                        return false;
                    }
                    
                    self._do_click_function.apply( self, arguments );
                } // end of _mouseup()
            },
            
            header_template = ( function () {
                var header_template = d.createElement( 'h1' ),
                    header_style = header_template.style;
                
                header_style.fontSize = '16px';
                header_style.margin = '0 0 8px';
                header_style.padding = '6px 8px 2px';
                //header_style.height = '16px';
                header_style.fontFamily = FONT_FAMILY;
                header_style.lineHeight = '0.8';
                
                return header_template;
            } )(),
            
            button_container_template = ( function () {
                var button_container_template = d.createElement( 'div' ),
                    button = d.createElement( 'button' ),
                    button_container_style = button_container_template.style,
                    button_style = button.style,
                    alt_text = ( is_mac() ) ? '[option]' : '[Alt]',
                    button_title;
                
                if ( OPTIONS.DISPLAY_ALL_IN_ONE_PAGE ) {
                    button_title = escape_html( '[Click]: ' + OPTIONS.BUTTON_HELP_DISPLAY_ALL_IN_ONE_PAGE + ' / ' + alt_text + '+[Click]: ' + OPTIONS.BUTTON_HELP_DISPLAY_ONE_PER_PAGE );
                    
                }
                else {
                    button_title = escape_html( '[Click]: ' + OPTIONS.BUTTON_HELP_DISPLAY_ONE_PER_PAGE + ' / ' + alt_text + '+[Click]: ' + OPTIONS.BUTTON_HELP_DISPLAY_ALL_IN_ONE_PAGE );
                }
                
                button_container_template.setAttribute( 'data-original-title', button_title );
                
                if ( is_legacy_tweetdeck() ) {
                    button.title = button_title;
                }
                
                button.className = 'btn';
                button.textContent = escape_html( OPTIONS.BUTTON_TEXT );
                button_container_template.className = 'ProfileTweet-action ' + button_container_classname + ' js-tooltip';
                button_container_template.appendChild( button );
                
                button_style.position = 'relative';
                
                const
                    loading_container = d.createElement( 'div' ),
                    loading_container_style = loading_container.style,
                    svg_doc = new DOMParser().parseFromString( LOADING_SVG, 'application/xml' );
                
                loading_container.classList.add( 'loading' );
                
                loading_container_style.display = 'none';
                loading_container_style.position = 'absolute';
                loading_container_style.top = '0';
                loading_container_style.right = '0';
                loading_container_style.width = '24px';
                loading_container_style.color = 'rgb(29, 155, 240)';
                
                loading_container.appendChild(
                    loading_container.ownerDocument.importNode( svg_doc.documentElement, true )
                );
                
                button.appendChild( loading_container );
                
                return button_container_template;
            } )(),
            
            link_template = ( function () {
                var link_template = d.createElement( 'a' ),
                    link_style = link_template.style;
                
                link_template.target = '_blank';
                link_style.textDecoration = 'none';
                link_style.color = '#66757f';
                
                return link_template;
            } )(),
            
            img_template = ( function () {
                // Image Display
                var img_template = d.createElement( 'img' ),
                    img_style = img_template.style;
                
                img_style.maxWidth = '100%';
                img_style.height = 'auto';
                img_style.background = 'white';
                img_style.margin = '0 auto';
                
                return img_template;
            } )(),
            
            video_template = ( function () {
                // Video / GIF Display (same style as images)
                var video_template = d.createElement( 'video' ),
                    video_style = video_template.style;
                
                video_template.setAttribute( 'playsinline', '' );
                video_template.setAttribute( 'preload', 'metadata' );
                video_style.maxWidth = '100%';
                video_style.height = 'auto';
                video_style.background = 'white';
                video_style.margin = '0 auto';
                
                return video_template;
            } )(),
            
            video_link_template = ( function () {
                // 動画はコントロールを操作できるようにリンク(a)で囲まない
                var video_link_template = d.createElement( 'div' );
                
                return video_link_template;
            } )(),
            
            img_link_container_template = ( function () {
                var img_link_container_template = d.createElement( 'div' ),
                    img_link_container_style = img_link_container_template.style;
                
                img_link_container_template.className = 'image-link-container';
                img_link_container_style.clear = 'both';
                img_link_container_style.margin = '0 auto 8px auto';
                img_link_container_style.padding = '0 0 4px 0';
                img_link_container_style.textAlign = 'center';
                img_link_container_style.position = 'relative';
                
                return img_link_container_template;
            } )(),
            
            help_item_template = ( function () {
                var help_item_template = d.createElement( 'span' ),
                    help_item_template_style = help_item_template.style;
                
                help_item_template_style.className = 'help-item';
                help_item_template_style.marginRight = '4px';
                help_item_template_style.fontSize = '14px';
                help_item_template_style.fontWeight = 'normal';
                help_item_template_style.pointerEvents = 'auto';
                help_item_template_style.cursor = 'pointer';
                //help_item_template_style.color = 'black';
                
                return help_item_template;
            } )(),
            
            download_link_container_template = ( function () {
                var download_link_container_template = d.createElement( 'div' ),
                    download_link_container_style = download_link_container_template.style;
                
                download_link_container_template.className = 'download-link-container';
                download_link_container_style.margin = '0 0 1px 0';
                download_link_container_style.padding = '0 0 0 0';
                
                if ( OPTIONS.HIDE_DOWNLOAD_BUTTON_AUTOMATICALLY ) {
                    download_link_container_style.opacity = '1.0';
                    download_link_container_style.transition = 'opacity .5s ease-in-out';
                    download_link_container_style.position = 'absolute';
                    download_link_container_style.top = '0';
                    download_link_container_style.left = '0';
                    download_link_container_style.background = 'rgba( 0, 0, 0, 0.5 )';
                    download_link_container_style.width = '100%';
                    //download_link_container_style.height = '50%';
                    download_link_container_style.minHeight = '50px';
                }
                
                return download_link_container_template;
            } )(),
            
            download_frame_template = ( function () {
                var download_frame_template = d.createElement( 'iframe' ),
                    download_frame_style = download_frame_template.style;
                
                download_frame_template.name = SCRIPT_NAME + '_download_frame';
                download_frame_style.width = '0';
                download_frame_style.height = '0';
                download_frame_style.visibility = 'hidden';
                
                // TweetDeck で、ダウンロードを行うと下部に隙間ができる（縦スクロールバーが表示されてしまう）不具合への対策
                download_frame_style.position = 'absolute';
                download_frame_style.top = '0';
                download_frame_style.left = '0';
                download_frame_style.pointerEvents = 'none';
                
                return download_frame_template;
            } )(),
            
            image_overlay = ( function () {
                var //top_offset = 26,
                    image_overlay_image_container = ( function () {
                        var image_overlay_image_container = d.createElement( 'div' ),
                            image_overlay_image_container_style = image_overlay_image_container.style;
                        
                        image_overlay_image_container.className = SCRIPT_NAME + '_image_overlay_image_container';
                        image_overlay_image_container_style.width = '100%';
                        image_overlay_image_container_style.height = 'auto';
                        
                        return image_overlay_image_container;
                    } )(),
                    
                    image_overlay_container = ( function () {
                        var image_overlay_container = d.createElement( 'div' ),
                            image_overlay_container_style = image_overlay_container.style,
                            timerid_list = [];
                        
                        image_overlay_container.id = SCRIPT_NAME + '_image_overlay_container';
                        image_overlay_container_style.display = 'none';
                        image_overlay_container_style.position = 'fixed';
                        image_overlay_container_style.top = 0;
                        image_overlay_container_style.bottom = 0;
                        image_overlay_container_style.left = 0;
                        image_overlay_container_style.right = 0;
                        image_overlay_container_style.overflow = 'auto';
                        image_overlay_container_style.zIndex = 10000;
                        image_overlay_container_style.padding = top_offset + 'px 0 0 0';
                        image_overlay_container_style.background = 'rgba( 0, 0, 0, 0.8 )';
                        
                        image_overlay_container.appendChild( image_overlay_image_container );
                        
                        
                        function clear_timerid_list() {
                            while ( 0 < timerid_list.length ) {
                                var timerid = timerid_list.pop();
                                clearTimeout( timerid );
                            }
                        } // end of clear_timerid_list()
                        
                        
                        function remove_timerid( timerid ) {
                            var index = timerid_list.indexOf( timerid );
                            if ( 0 <= index ) {
                                timerid_list.splice( index, 1 );
                            }
                        } // end of remove_timerid()
                        
                        
                        function lock_mouseover( wait_offset ) {
                            if ( ! wait_offset ) {
                                wait_offset = 0;
                            }
                            var timerid = setTimeout( function() {
                                remove_timerid( timerid );
                            }, wait_offset + 500 );
                            
                            timerid_list.push( timerid );
                        } // end of lock_mouseover()
                        
                        
                        function mouseover_is_locked() {
                            return ( 0 < timerid_list.length );
                        } // end of mouseover_is_locked()
                        
                        
                        function set_image_container_to_current( target_container, options ) {
                            if ( ! target_container ) {
                                return;
                            }
                            
                            if ( ! options ) {
                                options = {};
                            }
                            
                            var scroll_to = options.scroll_to,
                                smooth_scroll = options.smooth_scroll;
                            
                            if ( ! target_container.classList.contains( 'current' ) ) {
                                var current_container = image_overlay_container.querySelector( '.image-link-container.current' ),
                                    download_link;
                                
                                if ( current_container ) {
                                    download_link = current_container.querySelector( '.download-link' );
                                    
                                    if ( download_link ) {
                                        download_link.style.border = 'solid 2px #e1e8ed';
                                        download_link.style.background = 'white';
                                    }
                                    current_container.style.background = 'transparent';
                                    current_container.classList.remove( 'current' );
                                }
                                
                                target_container.classList.add( 'current' );
                                target_container.style.background = 'rgba( 128, 128, 128, 0.1 )';
                                
                                download_link = target_container.querySelector( '.download-link' );
                                
                                if ( download_link ) {
                                    download_link.style.border = 'solid 2px silver';
                                    download_link.style.background = 'lightyellow';
                                }
                                
                                update_overlay_status( target_container );
                            }
                            
                            if ( ! scroll_to ) {
                                return;
                            }
                            
                            if ( smooth_scroll ) {
                                var target_container_top = target_container.getBoundingClientRect().top - top_offset,
                                    scroll_height = Math.abs( target_container_top ),
                                    scroll_direction = ( target_container_top < 0 ) ? -1 : 1;
                                
                                image_overlay_container_smooth_scroll( {
                                    scroll_height : scroll_height
                                ,   step : scroll_direction * OPTIONS.SMOOTH_SCROLL_STEP
                                ,   lock_after_scroll : true
                                } );
                            }
                            else {
                                image_overlay_container_scroll_to( {
                                    offset : target_container.getBoundingClientRect().top - top_offset
                                ,   lock_after_scroll : true
                                } );
                            }
                        } // end of set_image_container_to_current()
                        
                        
                        function image_overlay_container_scroll_to( options ) {
                            options = ( options ) ? options : {};
                            
                            var offset = options.offset,
                                lock_after_scroll = options.lock_after_scroll;
                            
                            if ( lock_after_scroll ) {
                                // スクロール完了後にウェイトを設ける(mousemove等のイベントをすぐには発火させないため)
                                lock_mouseover();
                            }
                            image_overlay_container.scrollTop = offset;
                        } // end of image_overlay_container_scroll_to()
                        
                        
                        function image_overlay_container_horizontal_scroll_to( options ) {
                            options = ( options ) ? options : {};
                            
                            var offset = options.offset,
                                lock_after_scroll = options.lock_after_scroll;
                            
                            if ( lock_after_scroll ) {
                                // スクロール完了後にウェイトを設ける(mousemove等のイベントをすぐには発火させないため)
                                lock_mouseover();
                            }
                            image_overlay_container.scrollLeft = offset;
                        } // end of image_overlay_container_horizontal_scroll_to()
                        
                        
                        function image_overlay_container_scroll_step( step ) {
                            image_overlay_container_scroll_to( {
                                offset : image_overlay_container.scrollTop + step
                            } );
                        } // end of image_overlay_container_scroll_step()
                        
                        
                        function image_overlay_container_horizontal_scroll_step( step ) {
                            image_overlay_container_horizontal_scroll_to( {
                                offset : image_overlay_container.scrollLeft + step
                            } );
                        } // end of image_overlay_container_horizontal_scroll_step()
                        
                        
                        function image_overlay_container_smooth_scroll( options ) {
                            options = ( options ) ? options : {};
                            
                            var scroll_height = options.scroll_height,
                                step = options.step,
                                interval = options.interval,
                                lock_after_scroll = options.lock_after_scroll,
                                remain_height = scroll_height;
                            
                            step = ( step ) ? step : OPTIONS.SMOOTH_SCROLL_STEP;
                            
                            var direction = ( step < 0 ) ? -1 : 1;
                            
                            step = Math.abs( step );
                            interval = ( interval ) ? interval : OPTIONS.SMOOTH_SCROLL_INTERVAL;
                            
                            
                            function step_scroll( remain_height, timing ) {
                                var timerid = setTimeout( function () {
                                    var current_step = direction * ( ( step < remain_height ) ? step : remain_height );
                                    image_overlay_container_scroll_step( current_step );
                                    
                                    remove_timerid( timerid );
                                }, timing );
                                
                                timerid_list.push( timerid );
                            } // end of step_scroll()
                            
                            
                            for ( var ci = 0; 0 < remain_height; ci ++, remain_height -= step ) {
                                step_scroll( remain_height, interval * ci );
                            }
                            
                            if ( lock_after_scroll ) {
                                // スクロール完了後にウェイトを設ける(mousemove等のイベントをすぐには発火させないため)
                                lock_mouseover( interval * ci );
                            }
                        } // end of image_overlay_container_smooth_scroll()
                        
                        
                        function image_overlay_container_page_step( direction ) {
                            direction = ( direction ) ? direction : 1;
                            
                            image_overlay_container_smooth_scroll( {
                                scroll_height : image_overlay_container.clientHeight
                            ,   step : direction * OPTIONS.SMOOTH_SCROLL_STEP - top_offset 
                            } );
                        
                        } // end of image_overlay_container_page_step()
                        
                        
                        function image_overlay_container_image_init() {
                            var image_link_containers = to_array( image_overlay_container.querySelectorAll( '.image-link-container' ) ),
                                start_container = image_overlay_container.querySelector( '.image-link-container.start' );
                            
                            start_container = ( start_container ) ? start_container : image_overlay_container.querySelector( '.image-link-container' );
                            
                            image_link_containers.forEach( function ( image_link_container, index ) {
                                var image_link = image_link_container.querySelector( '.image-link' ),
                                    original_image = image_link.querySelector( '.original-image' ),
                                    mouse_click = object_extender( MouseClick );
                                
                                
                                function disable_event( event ) {
                                    event.stopPropagation();
                                    event.preventDefault();
                                } // end of disable_event( event );
                                
                                
                                function set_focus( event ) {
                                    event.stopPropagation();
                                    event.preventDefault();
                                    
                                    set_image_container_to_current( image_link_container, {
                                        scroll_to : true
                                    ,   smooth_scroll : true
                                    } );
                                } // end of set_focus()
                                
                                
                                function set_focus_mouseover( event ) {
                                    if ( mouseover_is_locked() ) {
                                        return;
                                    }
                                    set_image_container_to_current( image_link_container );
                                } // end of set_focus_mouseover()
                                
                                
                                original_image.setAttribute( 'draggable', false );
                                add_event( original_image, 'dragstart', disable_event );
                                
                                image_link.setAttribute( 'draggable', false );
                                add_event( image_link, 'dragstart', disable_event );
                                
                                mouse_click.init( image_link, image_overlay_container ).start( set_focus );
                                add_event( image_link_container, 'mouseover', set_focus_mouseover );
                                add_event( image_link_container, 'mousemove', set_focus_mouseover );
                                add_event( image_link_container, 'remove-mouse-click-event', function ( event ) {
                                    mouse_click.stop();
                                    
                                    var download_link = image_link_container.querySelector( '.download-link' );
                                    
                                    if ( download_link ) {
                                        fire_event( download_link, 'remove-mouse-click-event-download' );
                                    }
                                } );
                            } );
                            
                            fire_event( image_overlay_container, 'toggle-image-size' );
                            
                            image_overlay_image_container.style.visibility = 'visible';
                            
                            set_image_container_to_current( start_container, {
                                scroll_to : true
                            } );
                        } // end of image_overlay_container_image_init()
                        
                        
                        function image_overlay_container_image_step( direction ) {
                            direction = ( direction ) ? direction : 1;
                            
                            var image_link_containers = to_array( image_overlay_container.querySelectorAll( '.image-link-container' ) ),
                                current_container = image_overlay_container.querySelector( '.image-link-container.current' ),
                                next_container;
                            
                            if ( image_link_containers.length <= 0 ) {
                                return;
                            }
                            
                            if ( current_container ) {
                                next_container = ( 0 < direction ) ? current_container.nextSibling : current_container.previousSibling;
                                
                                while ( next_container ) {
                                    if ( next_container.classList.contains( 'image-link-container' ) ) {
                                        break;
                                    }
                                    next_container = ( 0 < direction ) ? next_container.nextSibling : next_container.previousSibling;
                                }
                                if ( ! next_container ) {
                                    next_container = ( 0 < direction ) ? image_link_containers[ 0 ] : image_link_containers[ image_link_containers.length - 1 ];
                                }
                            }
                            else {
                                next_container = image_link_containers[ 0 ];
                            }
                            
                            set_image_container_to_current( next_container, {
                                scroll_to : true
                            ,   smooth_scroll : true
                            } );
                        } // end of image_overlay_container_image_step()
                        
                        
                        function image_overlay_container_download_current_image() {
                            var download_link = image_overlay_container.querySelector( '.image-link-container.current .download-link' );
                            
                            if ( download_link ) {
                                fire_event( download_link, 'MouseClick' );
                            }
                        } // end of image_overlay_container_download_current_image()
                        
                        
                        function image_overlay_container_download_image_zip() {
                            if ( is_arraybuffer_bug() ) {
                                return;
                            }
                            var tweet_url = image_overlay_close_link.href,
                                //img_urls = to_array( image_overlay_container.querySelectorAll( '.image-link-container .download-link' ) ).map( function ( download_link ) {
                                //    return download_link.href;
                                //} ),
                                img_urls = JSON.parse( decodeURIComponent( image_overlay_close_link.getAttribute( 'data-all-img-urls' ) ) ),
                                tweet_info_json = JSON.stringify( {
                                    url : tweet_url
                                ,   img_urls : img_urls
                                ,   title : image_overlay_close_link.title
                                ,   fullname : image_overlay_close_link.getAttribute( 'data-fullname' )
                                ,   username : image_overlay_close_link.getAttribute( 'data-username' )
                                ,   timestamp_ms : image_overlay_close_link.getAttribute( 'data-timestamp-ms' )
                                } );
                            
                            // TODO: Chrome でも IFRAME 経由の呼び出しが CSP にひっかかるようになってしまった(Chrome 65.0.3325.162)
                            // ※(srcを画像のURL(https://pbs.twimg.com/media/*)とした)IFRAME内で、a[download]にて Blob URL を指定してダウンロードしようとすると、CSPエラー発生
                            // →主要ブラウザでは XMLHttpRequest Level 2 対応しているため、直接呼び出し
                            download_zip( tweet_info_json );
                            
                            return;
                            
                            /*
                            //if (
                            //    is_firefox() ||
                            //    // TODO: Firefox の場合、IFRAME 経由で呼び出すと、ダウンロード用の a#href に blob:～ を入れた時点で CSP に引っかかってしまう
                            //    // →対策として、cross-domain 対応の GM_xmlhttpRequest を使用し、IFRAME 経由ではなく直接呼び出し
                            //    is_edge()
                            //    // TODO: MS-Edge ＋ Tampermonkey の場合、IFRAME 経由で呼び出すと、window.name の値が読めない
                            //    // → Firefox と同じく、cross-domain 対応の GM_xmlhttpRequest を使用し、IFRAME 経由ではなく直接呼び出し
                            //) {
                            //    
                            //    if ( typeof GM_xmlhttpRequest == 'function' ) {
                            //        download_zip( tweet_info_json );
                            //    }
                            //    else {
                            //        w.open( img_urls[ 0 ], encodeURIComponent( tweet_info_json ) );
                            //    }
                            //    return false;
                            //}
                            //
                            //var old_iframe = d.querySelector( 'iframe#' + SCRIPT_NAME + '_download_zip_frame' ),
                            //    iframe = import_node( download_frame_template );
                            //
                            //
                            //if ( old_iframe ) {
                            //    old_iframe.parentNode.removeChild( old_iframe );
                            //    old_iframe = null;
                            //}
                            //iframe.id = SCRIPT_NAME + '_download_zip_frame';
                            //iframe.name = encodeURIComponent( tweet_info_json );
                            //iframe.src = img_urls[ 0 ];
                            //d.documentElement.appendChild( iframe );
                            */
                        } // end of image_overlay_container_download_image_zip()
                        
                        
                        add_event( image_overlay_container, 'lock-mouseover', function() {
                            lock_mouseover();
                        } );
                        
                        add_event( image_overlay_container, 'scroll-to-top', function () {
                            clear_timerid_list();
                            image_overlay_container_scroll_to( {
                                offset : 0
                            } );
                        } );
                        
                        add_event( image_overlay_container, 'scroll-to-bottom', function () {
                            clear_timerid_list();
                            image_overlay_container_scroll_to( {
                                offset : image_overlay_container.scrollHeight
                            } );
                        } );
                        
                        add_event( image_overlay_container, 'smooth-scroll-to-top', function () {
                            clear_timerid_list();
                            image_overlay_container_smooth_scroll( {
                                scroll_height : image_overlay_container.scrollTop
                            ,   step : - OPTIONS.SMOOTH_SCROLL_STEP
                            } );
                        } );
                        
                        add_event( image_overlay_container, 'smooth-scroll-to-bottom', function () {
                            clear_timerid_list();
                            image_overlay_container_smooth_scroll( {
                                scroll_height : image_overlay_container.scrollHeight - image_overlay_container.scrollTop
                            ,   step : OPTIONS.SMOOTH_SCROLL_STEP
                            } );
                        } );
                        
                        add_event( image_overlay_container, 'scroll-to-horizontal-middle', function () {
                            clear_timerid_list();
                            
                            if ( w.innerWidth < image_overlay_container.scrollWidth ) {
                                image_overlay_container_horizontal_scroll_to( {
                                    offset : ( image_overlay_container.scrollWidth - w.innerWidth ) / 2
                                } );
                            }
                        } );
                        
                        add_event( image_overlay_container, 'scroll-to-current-image-container', function () {
                            clear_timerid_list();
                            
                            set_image_container_to_current( image_overlay_container.querySelector( '.image-link-container.current' ), {
                                scroll_to : true
                            ,   smooth_scroll : true
                            } );
                        } );
                        
                        add_event( image_overlay_container, 'scroll-down', function () {
                            clear_timerid_list();
                            image_overlay_container_scroll_step( OPTIONS.SCROLL_STEP );
                        } );
                        
                        add_event( image_overlay_container, 'scroll-up', function () {
                            clear_timerid_list();
                            image_overlay_container_scroll_step( - OPTIONS.SCROLL_STEP );
                        } );
                        
                        add_event( image_overlay_container, 'scroll-left', function () {
                            clear_timerid_list();
                            image_overlay_container_horizontal_scroll_step( - OPTIONS.SCROLL_STEP );
                        } );
                        
                        add_event( image_overlay_container, 'scroll-right', function () {
                            clear_timerid_list();
                            image_overlay_container_horizontal_scroll_step( OPTIONS.SCROLL_STEP );
                        } );
                        
                        add_event( image_overlay_container, 'page-up', function () {
                            clear_timerid_list();
                            image_overlay_container_page_step( -1 );
                        } );
                        
                        add_event( image_overlay_container, 'page-down', function () {
                            clear_timerid_list();
                            image_overlay_container_page_step();
                        } );
                        
                        add_event( image_overlay_container, 'image-init', function () {
                            clear_timerid_list();
                            image_overlay_container_image_init();
                        } );
                        
                        add_event( image_overlay_container, 'image-next', function () {
                            clear_timerid_list();
                            image_overlay_container_image_step();
                        } );
                        
                        add_event( image_overlay_container, 'image-prev', function () {
                            clear_timerid_list();
                            image_overlay_container_image_step( -1 );
                        } );
                        
                        add_event( image_overlay_container, 'download-image', function () {
                            clear_timerid_list();
                            image_overlay_container_download_current_image();
                        } );
                        
                        add_event( image_overlay_container, 'download-image-zip', function () {
                            clear_timerid_list();
                            image_overlay_container_download_image_zip();
                        } );
                        
                        d.body.appendChild( image_overlay_container );
                        
                        return image_overlay_container;
                    } )(),
                    
                    image_overlay_loading = ( function () {
                        var image_overlay_loading = d.createElement( 'div' ),
                            image_overlay_loading_style = image_overlay_loading.style,
                            loading = d.createElement( 'img' ),
                            loading_style = loading.style;
                        
                        image_overlay_loading.id = SCRIPT_NAME + '_image_overlay_loading';
                        image_overlay_loading_style.display = 'none';
                        image_overlay_loading_style.pointerEvents = 'none';
                        image_overlay_loading_style.position = 'fixed';
                        image_overlay_loading_style.top = 0;
                        image_overlay_loading_style.right = 0;
                        image_overlay_loading_style.bottom = 0;
                        image_overlay_loading_style.left = 0;
                        image_overlay_loading_style.zIndex = 10010;
                        image_overlay_loading_style.background = 'rgba( 255, 255, 255, 0.8 )';
                        
                        loading.src = 'https://abs.twimg.com/a/1460504487/img/t1/spinner-rosetta-gray-32x32.gif';
                        loading_style.position = 'absolute';
                        loading_style.top = 0;
                        loading_style.right = 0;
                        loading_style.bottom = 0;
                        loading_style.left = 0;
                        loading_style.margin = 'auto';
                        loading_style.opacity = 0.8;
                        
                        image_overlay_loading.appendChild( loading );
                        
                        d.body.appendChild( image_overlay_loading );
                        
                        return image_overlay_loading;
                    } )(),
                    
                    image_overlay_close_link = ( function () {
                        var image_overlay_close_link = import_node( link_template ),
                            image_overlay_close_link_style = image_overlay_close_link.style;
                        
                        image_overlay_close_link.className = SCRIPT_NAME + '_close_overlay';
                        image_overlay_close_link_style.display = 'block';
                        image_overlay_close_link_style.cssFloat = 'right';
                        image_overlay_close_link_style.margin = '0 8px';
                        
                        image_overlay_close_link.appendChild( d.createTextNode( OPTIONS.CLOSE_TEXT ) );
                        
                        return image_overlay_close_link;
                    } )(),
                    
                    image_overlay_status_container = ( function () {
                        var image_overlay_status_container = d.createElement( 'div' ),
                            image_overlay_status_container_style = image_overlay_status_container.style;
                        
                        image_overlay_status_container.className = SCRIPT_NAME + '_status_overlay';
                        image_overlay_status_container_style.position = 'absolute';
                        image_overlay_status_container_style.display = 'block';
                        image_overlay_status_container_style.width = '100%';
                        image_overlay_status_container_style.top = 0;
                        //image_overlay_status_container_style.right = 0;
                        //image_overlay_status_container_style.bottom = 0;
                        //image_overlay_status_container_style.left = '16px';
                        image_overlay_status_container_style.left = '0';
                        //image_overlay_status_container_style.padding = '6px 0';
                        image_overlay_status_container_style.padding = '0';
                        image_overlay_status_container_style.paddingTop = '8px';
                        if ( 1024 < window.innerWidth ) {
                            image_overlay_status_container_style.textAlign = 'center';
                            image_overlay_status_container_style.paddingLeft = '0';
                        }
                        else {
                            image_overlay_status_container_style.textAlign = 'left';
                            image_overlay_status_container_style.paddingLeft = '16px';
                        }
                        image_overlay_status_container_style.pointerEvents = 'none';
                        //image_overlay_status_container_style.color = 'black';
                        
                        return image_overlay_status_container;
                    } )(),
                    
                    image_overlay_shortcut_help = ( function () {
                        var image_overlay_shortcut_help = d.createElement( 'div' ),
                            image_overlay_shortcut_help_style = image_overlay_shortcut_help.style;
                        
                        image_overlay_shortcut_help.className = SCRIPT_NAME + '_shortcut_help_overlay';
                        image_overlay_shortcut_help_style.cssFloat = 'left';
                        image_overlay_shortcut_help_style.margin = '2px 8px 2px';
                        if ( 1024 < window.innerWidth ) {
                            image_overlay_shortcut_help_style.marginLeft = '8px';
                        }
                        else {
                            image_overlay_shortcut_help_style.marginLeft = '64px';
                        }
                        
                        return image_overlay_shortcut_help;
                    } )(),
                    
                    image_overlay_header = ( function () {
                        var image_overlay_header = import_node( header_template ),
                            image_overlay_header_style = image_overlay_header.style;
                        
                        image_overlay_header.id = SCRIPT_NAME + '_image_overlay_header';
                        image_overlay_header_style.display = 'none';
                        image_overlay_header_style.position = 'fixed';
                        image_overlay_header_style.top = 0;
                        image_overlay_header_style.left = 0;
                        image_overlay_header_style.width = '100%';
                        image_overlay_header_style.padding = '6px 0 2px';
                        image_overlay_header_style.background = 'white';
                        image_overlay_header_style.borderBottom = 'solid 1px silver';
                        image_overlay_header_style.zIndex = 10020;
                        
                        image_overlay_header.appendChild( image_overlay_shortcut_help );
                        image_overlay_header.appendChild( image_overlay_status_container );
                        image_overlay_header.appendChild( image_overlay_close_link );
                        
                        d.body.appendChild( image_overlay_header );
                        
                        return image_overlay_header;
                    } )(),
                    
                    image_overlay_drag_scroll = object_extender( DragScroll ).init( image_overlay_container );
                
                return {
                    container : image_overlay_container
                ,   image_container : image_overlay_image_container
                ,   loading : image_overlay_loading
                ,   header : image_overlay_header
                ,   close_link : image_overlay_close_link
                ,   status_container : image_overlay_status_container
                ,   shortcut_help : image_overlay_shortcut_help
                ,   drag_scroll : image_overlay_drag_scroll
                };
            } )(),
            
            image_overlay_container = image_overlay.container,
            image_overlay_image_container = image_overlay.image_container,
            image_overlay_loading = image_overlay.loading,
            image_overlay_header = image_overlay.header,
            image_overlay_close_link = image_overlay.close_link,
            image_overlay_status_container = image_overlay.status_container,
            image_overlay_shortcut_help = image_overlay.shortcut_help,
            image_overlay_drag_scroll = image_overlay.drag_scroll;
        
        
        function mouse_is_on_scrollbar( event ) {
            var mouse_x = event.clientX,
                mouse_y = event.clientY,
                max_x = image_overlay_container.clientWidth,
                max_y = image_overlay_container.clientHeight;
            
            if ( ( mouse_x < 0 || max_x <= mouse_x ) || ( mouse_y < 0 || max_y <= mouse_y ) ) {
                return true;
            }
            
            return false;
        } // end of mouse_is_on_scrollbar()
        
        
        function add_images_to_page( img_urls, tweet_url, parent, options ) {
            if ( ! options ) {
                options = {};
            }
            var target_document = options.document,
                callback = options.callback,
                start_img_url = options.start_img_url;
            
            if ( ! target_document ) {
                target_document = d;
            }
            
            var remaining_images_counter = 0,
                filename_prefix = get_filename_prefix( tweet_url );
            
            img_urls.forEach( function ( img_url, index ) {
                var media_type = get_media_type( img_url ),
                    img = import_node( ( media_type == 'photo' ) ? img_template : video_template, target_document ),
                    link = import_node( ( media_type == 'video' ) ? video_link_template : link_template, target_document ),
                    img_link_container = import_node( img_link_container_template, target_document );
                
                if ( OPTIONS.DOWNLOAD_HELPER_SCRIPT_IS_VALID ) {
                    var download_link = create_download_link( img_url, target_document ),
                        download_link_container = import_node( download_link_container_template, target_document ),
                        mouse_click = object_extender( MouseClick ).init( download_link ),
                        img_filename = ( OPTIONS.SAME_FILENAME_AS_IN_ZIP ) ? get_zip_media_filename( filename_prefix, img_url, index ) : download_link.download;
                    
                    download_link.href = img_url;
                    
                    if ( is_bookmarklet() ) {
                        mouse_click.start( function ( event ) {
                            event.stopPropagation();
                        } );
                    }
                    else {
                        mouse_click.start( function ( event ) {
                            event.stopPropagation();
                            event.preventDefault();
                            
                            if ( media_type != 'photo' ) {
                                download_media_by_link( download_link, img_filename );
                                return false;
                            }
                            
                            /*
                            //var old_iframe = target_document.querySelector( 'iframe[name="' + SCRIPT_NAME + '_download_frame' + '"]' ),
                            //    iframe = import_node( download_frame_template, target_document );
                            //
                            //if ( old_iframe ) {
                            //    target_document.documentElement.removeChild( old_iframe );
                            //    old_iframe = null;
                            //}
                            //iframe.src = img_url;
                            //target_document.documentElement.appendChild( iframe );
                            */
                            /*
                            //if ( typeof GM_download == 'function' ) {
                            //    // TODO: GM_download() だとダウンロード先フォルダが記憶されない(？)
                            //    GM_download( {
                            //        url : download_link.href,
                            //        name : img_filename,
                            //    } );
                            //}
                            */
                            if ( typeof GM_xmlhttpRequest == 'function' ) {
                                GM_xmlhttpRequest( {
                                    method : 'GET',
                                    url : download_link.href,
                                    responseType : 'blob',
                                    onload : function ( response ) {
                                        save_blob( img_filename, response.response )
                                    },
                                    onerror : function ( response ) {
                                        log_error( 'Download failure:', download_link.href, img_filename, response.status, response.statusText );
                                        alert( 'Download failure:\n' + download_link.href );
                                    }
                                } );
                            }
                            else {
                                fetch( download_link.href )
                                .then( response => response.blob() )
                                .then( blob => save_blob( img_filename, blob ) )
                                .catch( error => {
                                    log_error( 'Download failure:', download_link.href, img_filename, error );
                                    alert( 'Download failure:\n' + download_link.href );
                                });
                            }
                            return false;
                        } );
                    }
                    
                    add_event( download_link, 'remove-mouse-click-event-download', function ( event ) {
                        mouse_click.stop();
                    } );
                    
                    
                    if ( OPTIONS.HIDE_DOWNLOAD_BUTTON_AUTOMATICALLY ) {
                        add_event( download_link_container, 'mouseover', function ( event ) {
                            download_link_container.style.opacity = '1.0';
                        } );
                        
                        add_event( download_link_container, 'mousemove', function ( event ) {
                            download_link_container.style.opacity = '1.0';
                        } );
                        
                        add_event( download_link_container, 'mouseout', function ( event ) {
                            download_link_container.style.opacity = '0';
                        } );
                        
                        object_extender( MouseClick ).init( download_link_container ).start( function ( event ) {
                            event.stopPropagation();
                            event.preventDefault();
                            return false;
                        } );
                        
                        download_link_container.style.opacity = '0';
                    }
                    
                    download_link_container.appendChild( download_link );
                    img_link_container.appendChild( download_link_container );
                }
                
                img.className = 'original-image';
                
                remaining_images_counter ++;
                
                function check_loaded_image( event ) {
                    img.setAttribute( 'width', img.naturalWidth );
                    img.setAttribute( 'height', img.naturalHeight );
                    
                    remaining_images_counter --;
                    if ( remaining_images_counter <= 0 && typeof callback == 'function' ) {
                        callback();
                    }
                } // end of check_loaded_image()
                
                var is_video_checked = false;
                
                function check_loaded_video( event ) {
                    if ( is_video_checked ) {
                        return;
                    }
                    is_video_checked = true;
                    
                    if ( img.videoWidth ) {
                        img.setAttribute( 'width', img.videoWidth );
                        img.setAttribute( 'height', img.videoHeight );
                    }
                    
                    remaining_images_counter --;
                    if ( remaining_images_counter <= 0 && typeof callback == 'function' ) {
                        callback();
                    }
                } // end of check_loaded_video()
                
                if ( media_type == 'photo' ) {
                    add_event( img, 'load', check_loaded_image );
                    add_event( img, 'error', function ( event ) {
                        if ( /\.jpg/.test( img.src ) ) {
                            img.src = img.src.replace( /\.jpg/, '.png' );
                            return;
                        }
                        check_loaded_image( event );
                    });
                }
                else {
                    add_event( img, 'loadedmetadata', check_loaded_video );
                    add_event( img, 'error', check_loaded_video );
                    
                    if ( media_type == 'animated_gif' ) {
                        // GIF: 画像と同様に表示(ループ再生)
                        img.muted = true;
                        img.loop = true;
                        img.autoplay = true;
                        img.setAttribute( 'muted', '' );
                        img.setAttribute( 'loop', '' );
                        img.setAttribute( 'autoplay', '' );
                    }
                    else {
                        img.controls = true;
                        img.setAttribute( 'controls', '' );
                        
                        // コントロールの操作がオーバーレイのクリック(閉じる)・ドラッグスクロールとならないようにする
                        [ 'click', 'mousedown', 'mouseup' ].forEach( function ( event_name ) {
                            add_event( img, event_name, function ( event ) {
                                event.stopPropagation();
                            } );
                        } );
                        
                        // ネイティブコントロールにフォーカスがあるとキー入力がページに届かない([Esc]等が効かなくなる)ため、フォーカスを戻す
                        add_event( img, 'focus', function ( event ) {
                            setTimeout( function () {
                                img.blur();
                            }, 0 );
                        } );
                    }
                }
                
                //img.src = link.href = img_url;
                img.src = img_url;
                if ( link.tagName == 'A' ) {
                    link.href = ( OPTIONS.SAME_FILENAME_AS_IN_ZIP && tweet_url ) ? ( tweet_url + '/photo/' + ( index + 1 ) ) : img_url;
                }
                
                link.className = 'image-link';
                link.appendChild( img );
                
                add_event( link, 'click', function ( event ) {
                    event.stopPropagation();
                } );
                
                img_link_container.appendChild( link );
                
                if ( get_media_key( img_url ) == get_media_key( start_img_url ) ) {
                    img_link_container.classList.add( 'start' );
                }
                img_link_container.setAttribute( 'data-image-number', index + 1 );
                img_link_container.setAttribute( 'data-image-total', img_urls.length );
                parent.appendChild( img_link_container );
            } );
        } // end of add_images_to_page()
        
        
        function update_overlay_status( target_container ) {
            if ( ! target_container ) {
                return;
            }
            clear_node( image_overlay_status_container );
            image_overlay_status_container.appendChild( d.createTextNode( target_container.getAttribute( 'data-image-number' ) + ' / ' + target_container.getAttribute( 'data-image-total' ) ) );
        } // end of update_overlay_status()
        
        
        function show_overlay( img_urls, tweet_url, title, start_img_url, tweet, all_img_urls ) {
            if ( image_overlay_container.style.display != 'none' ) {
                //log_error( 'show_overlay(): duplicate called' );
                // TODO: 重複して呼ばれるケース(不正な動作)に対するガード
                return;
            }
            
            var html_element = d.querySelector( 'html' ),
                body = d.body,
                author_info = get_tweet_author_info( tweet ),
                fullname = author_info.fullname,
                username = author_info.username,
                timestamp_ms = author_info.timestamp_ms;
            

            var image_overlay_container_style = image_overlay_container.style,
                image_overlay_loading_style = image_overlay_loading.style,
                image_overlay_header_style = image_overlay_header.style,
                image_overlay_image_container_style = image_overlay_image_container.style,
                html_style = html_element.style,
                body_style = body.style,
                
                saved_html_overflowX = html_style.overflowX,
                saved_html_overflowY = html_style.overflowY,
                saved_body_position = body_style.position,
                saved_body_overflowX = body_style.overflowX,
                saved_body_overflowY = body_style.overflowY,
                saved_body_marginRight = body_style.marginRight,
                
                event_list = [],
                image_overlay_container_mouse_click = object_extender( MouseClick ),
                
                on_wheel = ( event ) => {
                    var flag_to_ignore = false,
                        target_container = ( image_overlay_container_style.overflow == 'hidden' ) ? image_overlay_image_container : image_overlay_container,
                        scroll_height = target_container.scrollHeight,
                        scroll_top = target_container.scrollTop,
                        container_rect = target_container.getBoundingClientRect();
                    
                    log_debug( '### on_wheel()', scroll_height, scroll_top, container_rect, event );
                    
                    if ( scroll_height <= container_rect.height ) {
                        flag_to_ignore = true;
                    }
                    else {
                        if ( event.deltaY < 0 ) {
                            if ( scroll_top <= 0 ) {
                                flag_to_ignore = true;
                            }
                        }
                        else if ( 0 < event.deltaY ) {
                            if ( scroll_height <= scroll_top + container_rect.height ) {
                                flag_to_ignore = true;
                            }
                        }
                    }
                    
                    if ( ! flag_to_ignore ) {
                        return;
                    }
                    
                    log_debug( '*** on_wheel(): event ignored', event );
                    event.preventDefault();
                    event.stopPropagation();
                };
            
            function add_events() {
                if ( is_twitter() ) {
                    image_overlay_container.addEventListener( 'wheel', on_wheel, { passive: false } );
                }
                event_list.forEach( function ( event_item ) {
                    add_event( event_item.element,  event_item.name, event_item.func, true );
                } );
                
                image_overlay_container_mouse_click.init( image_overlay_container, image_overlay_container ).start( close_image_overlay_container );
            } // end of add_events()
            
            
            function remove_events() {
                var _event_list = event_list.slice( 0 );
                
                image_overlay_container_mouse_click.stop();
                
                _event_list.reverse();
                _event_list.forEach( function ( event_item ) {
                    remove_event( event_item.element, event_item.name, event_item.func );
                } );
                
                to_array( image_overlay_image_container.querySelectorAll( '.image-link-container' ) ).forEach( function ( image_link_container ) {
                    fire_event( image_link_container, 'remove-mouse-click-event' );
                } );
                
                if ( is_twitter() ) {
                    image_overlay_container.removeEventListener( 'wheel', on_wheel );
                }
            } // end of remove_events()
            
            
            function close_image_overlay_container( event ) {
                event.stopPropagation();
                event.preventDefault();
                
                image_overlay_drag_scroll.stop();
                
                fire_event( image_overlay_container, 'scroll-to-top' );
                
                image_overlay_image_container_style.visibility = 'hidden';
                image_overlay_header_style.display = 'none';
                image_overlay_loading_style.display = 'none';
                image_overlay_container_style.display = 'none';
                
                if ( is_legacy_tweetdeck() ) {
                    body_style.marginRight = saved_body_marginRight;
                    body_style.overflowX = saved_body_overflowX;
                    body_style.overflowY = saved_body_overflowY;
                    html_style.overflowX = saved_html_overflowX;
                    html_style.overflowY = saved_html_overflowY;
                }
                else {
                    /*
                    //[2020.12] Twitter側の変更のためか、一番上にスクロールしてしまうようになってしまった
                    //body_style.marginRight = saved_body_marginRight;
                    //body_style.overflowX = saved_body_overflowX;
                    //body_style.overflowY = saved_body_overflowY;
                    */
                    html_style.overflowX = saved_html_overflowX;
                    html_style.overflowY = saved_html_overflowY;
                }
                
                remove_events();
                
                clear_node( image_overlay_image_container );
                
                return false;
            } // end of close_image_overlay_container()
            
            
            image_overlay_image_container_style.visibility = 'hidden';
            clear_node( image_overlay_image_container );
            
            image_overlay_close_link.href = tweet_url;
            image_overlay_close_link.title = title;
            image_overlay_close_link.setAttribute( 'data-fullname', fullname );
            image_overlay_close_link.setAttribute( 'data-username', username );
            image_overlay_close_link.setAttribute( 'data-timestamp-ms', timestamp_ms );
            image_overlay_close_link.setAttribute( 'data-img-urls', encodeURIComponent( JSON.stringify( img_urls ) ) );
            image_overlay_close_link.setAttribute( 'data-all-img-urls', encodeURIComponent( JSON.stringify( all_img_urls ) ) );
            
            if ( is_night_mode() ) {
                image_overlay_close_link.style.color = 'white';
                image_overlay_header.style.color = 'white';
                image_overlay_header.style.background = '#1b2836';
                image_overlay_header.style.borderBottom = 'solid 1px #141D26';
            }
            else {
                image_overlay_close_link.style.color = 'black';
                image_overlay_header.style.color = 'black';
                image_overlay_header.style.background = 'white';
                image_overlay_header.style.borderBottom = 'solid 1px silver';
            }
            
            add_images_to_page( img_urls, tweet_url, image_overlay_image_container, {
                start_img_url : start_img_url
            ,   callback : function () {
                    if ( image_overlay_container.style.display == 'none' ) {
                        return;
                    }
                    image_overlay_loading_style.display = 'none';
                    fire_event( image_overlay_container, 'image-init' );
                }
            } );
            
            update_overlay_status( image_overlay_container.querySelector( '.image-link-container.start' ) );
            
            clear_node( image_overlay_shortcut_help );
            
            if ( 1 < image_overlay_image_container.querySelectorAll( '.image-link-container' ).length ) {
                var help_move_next = import_node( help_item_template ),
                    help_move_previous = import_node( help_item_template );
                
                help_move_next.classList.add( 'help-move-next' );
                help_move_next.appendChild( d.createTextNode( OPTIONS.HELP_OVERLAY_SHORTCUT_MOVE_NEXT ) );
                add_event( help_move_next, 'click', function ( event ) {
                    event.stopPropagation();
                    event.preventDefault();
                    
                    fire_event( image_overlay_container, 'image-next' );
                    
                    return false;
                } );
                
                image_overlay_shortcut_help.appendChild( help_move_next );
                
                help_move_previous.classList.add( 'help-move-previous' );
                help_move_previous.appendChild( d.createTextNode( OPTIONS.HELP_OVERLAY_SHORTCUT_MOVE_PREVIOUS ) );
                add_event( help_move_previous, 'click', function ( event ) {
                    event.stopPropagation();
                    event.preventDefault();
                    
                    fire_event( image_overlay_container, 'image-prev' );
                    
                    return false;
                } );
                
                image_overlay_shortcut_help.appendChild( help_move_previous );
            }
            
            if ( OPTIONS.DOWNLOAD_HELPER_SCRIPT_IS_VALID && tweet_url ) {
                var help_download = import_node( help_item_template );
                
                help_download.classList.add( 'help-download' );
                help_download.appendChild( d.createTextNode( OPTIONS.HELP_OVERLAY_SHORTCUT_DOWNLOAD ) );
                
                add_event( help_download, 'click', function ( event ) {
                    event.stopPropagation();
                    event.preventDefault();
                    
                    fire_event( image_overlay_container, 'download-image' );
                    
                    return false;
                } );
                
                image_overlay_shortcut_help.appendChild( help_download );
            }
            
            if ( OPTIONS.DOWNLOAD_HELPER_SCRIPT_IS_VALID && OPTIONS.DOWNLOAD_ZIP_IS_VALID && tweet_url ) {
                var help_download_zip = import_node( help_item_template );
                
                help_download_zip.classList.add( 'help-download-zip' );
                help_download_zip.appendChild( d.createTextNode( OPTIONS.HELP_OVERLAY_SHORTCUT_DOWNLOAD_ZIP ) );
                
                add_event( help_download_zip, 'click', function ( event ) {
                    event.stopPropagation();
                    event.preventDefault();
                    
                    fire_event( image_overlay_container, 'download-image-zip' );
                    
                    return false;
                } );
                
                image_overlay_shortcut_help.appendChild( help_download_zip );
            }
            
            var toggle_image_size = ( function () {
                var image_size_types = {
                        'fit-width' : 'full'
                    ,   'full' : 'fit-height'
                    ,   'fit-height' : 'fit-window'
                    ,   'fit-window' : 'fit-width'
                    },
                    help_image_size_types = {
                        'fit-width' : 'HELP_OVERLAY_SHORTCUT_SIZE_FIT_WIDTH'
                    ,   'full' : 'HELP_OVERLAY_SHORTCUT_SIZE_FULL'
                    ,   'fit-height' : 'HELP_OVERLAY_SHORTCUT_SIZE_FIT_HEIGHT'
                    ,   'fit-window' : 'HELP_OVERLAY_SHORTCUT_SIZE_FIT_WINDOW'
                    },
                    saved_image_size = localStorage[ SCRIPT_NAME + '_saved_image_size' ],
                    image_size = ( image_size_types[ saved_image_size ] ) ? saved_image_size : OPTIONS.DEFAULT_IMAGE_SIZE,
                    help = import_node( help_item_template ),
                    first_event = true;
                
                if ( ! image_size_types[ image_size ] ) {
                    image_size = OPTIONS.DEFAULT_IMAGE_SIZE;
                }
                
                help.classList.add( 'help-toggle-size' );
                
                add_event( help, 'click', function ( event ) {
                    event.stopPropagation();
                    event.preventDefault();
                    
                    fire_event( image_overlay_container, 'toggle-image-size' );
                    
                    return false;
                } );
                
                image_overlay_shortcut_help.appendChild( help );
                
                remove_event( image_overlay_container, 'image-fit-height' );
                remove_event( image_overlay_container, 'image-fit-window' );
                
                add_event( image_overlay_container, 'image-fit-height', function ( event ) {
                    if ( image_size != 'fit-height' ) {
                        return false;
                    }
                    
                    var first_image = image_overlay_image_container.querySelector( '.original-image' );
                    
                    if ( ! first_image ) {
                        return false;
                    }
                    
                    var first_element_top_offset = parseInt( getComputedStyle( image_overlay_container ).paddingTop ) + get_element_position( first_image ).y - get_element_position( image_overlay_image_container ).y,
                        maxWidth = w.innerWidth - 16, // TODO: スクロールバーの幅分を自動で調整したい
                        maxHeight_with_scrollbar = w.innerHeight - first_element_top_offset - 4, // TODO: パディング分を自動で調整したい
                        maxHeight = maxHeight_with_scrollbar, // TODO: スクロールバーの幅分を自動で調整したい
                        image_list = to_array( image_overlay_image_container.querySelectorAll( '.original-image' ) ),
                        overflow_image_list = [];
                    
                    if ( image_list.length == 1 ) {
                        // 1枚のみの場合、縦スクロールバーは出さない
                        // →調節してもスクロールバーが出てしまうことがあるので強制的に隠す
                        image_overlay_container.style.overflowY = 'hidden';
                        maxWidth = w.innerWidth;
                    }
                    else {
                        image_overlay_container.style.overflowY = 'auto';
                    }
                    
                    overflow_image_list = image_list.filter( function ( img, index ) {
                        if ( ( get_natural_width( img ) <= maxWidth ) && ( get_natural_height( img ) <= maxHeight_with_scrollbar ) ) {
                            return false;
                        }
                        else if ( ( get_natural_width( img ) * maxHeight_with_scrollbar / get_natural_height( img ) ) <= maxWidth ) {
                            return false;
                        }
                        return true;
                    } );
                    
                    if ( 0 < overflow_image_list.length ) {
                        maxHeight = maxHeight_with_scrollbar - 16;
                        image_overlay_container.style.overflowX = 'auto';
                    }
                    else {
                        // オーバーフローしないならば、横スクロールバーも出さない
                        // →調節してもスクロールバーが出てしまうことがあるので強制的に隠す
                        image_overlay_container.style.overflowX = 'hidden';
                    }
                    
                    image_list.forEach( function ( img ) {
                        img.style.maxHeight = maxHeight + 'px';
                    } );
                    
                    return false;
                }, true );
                
                add_event( image_overlay_container, 'image-fit-window', function ( event ) {
                    if ( image_size != 'fit-window' ) {
                        return false;
                    }
                    
                    var first_image = image_overlay_image_container.querySelector( '.original-image' );
                    
                    if ( ! first_image ) {
                        return false;
                    }
                    
                    var first_element_top_offset = parseInt( getComputedStyle( image_overlay_container ).paddingTop ) + get_element_position( first_image ).y - get_element_position( image_overlay_image_container ).y,
                        maxWidth = w.innerWidth,
                        maxHeight = w.innerHeight - first_element_top_offset - 4, // TODO: パディング分を自動で調整したい
                        image_list = to_array( image_overlay_image_container.querySelectorAll( '.original-image' ) );
                    
                    image_overlay_container.style.overflowX = 'hidden'; // 横スクロールバーは出さない
                    
                    if ( image_list.length == 1 ) {
                        // 1枚のみの場合、縦スクロールバーも出さない
                        // →調節してもスクロールバーが出てしまうことがあるので強制的に隠す
                        image_overlay_container.style.overflowY = 'hidden';
                    }
                    else {
                        image_overlay_container.style.overflowY = 'auto';
                    }
                    
                    image_list.forEach( function ( img ) {
                        if ( ( get_natural_width( img ) <= maxWidth ) && ( get_natural_height( img ) <= maxHeight ) ) {
                            return;
                        }
                        
                        if ( ( get_natural_height( img ) * maxWidth / get_natural_width( img ) ) <= maxHeight ) {
                            img.style.maxWidth = '100%';
                            return;
                        }
                        
                        img.style.maxHeight = maxHeight + 'px';
                    } );
                    
                    return false;
                }, true );
                
                remove_event( w, 'resize' );
                add_event( w, 'resize', function ( event ) {
                    switch ( image_size ) {
                        case 'fit-height' :
                            setTimeout( function () {
                                fire_event( image_overlay_container, 'image-fit-height' );
                            }, 100 );
                            break;
                        
                        case 'fit-window' :
                            setTimeout( function () {
                                fire_event( image_overlay_container, 'image-fit-window' );
                            }, 100 );
                            break;
                    }
                    adjust_last_image_link_container();
                    
                    if ( 1024 < window.innerWidth ) {
                        image_overlay_status_container.style.textAlign = 'center';
                        image_overlay_status_container.style.paddingLeft = '0';
                        image_overlay_shortcut_help.style.marginLeft = '8px';
                    }
                    else {
                        image_overlay_status_container.style.textAlign = 'left';
                        image_overlay_status_container.style.paddingLeft = '16px';
                        image_overlay_shortcut_help.style.marginLeft = '64px';
                    }
                    return false;
                }, true );
                
                
                function adjust_last_image_link_container() {
                    var image_link_containers = to_array( image_overlay_container.querySelectorAll( '.image-link-container' ) );
                    
                    if ( image_link_containers.length < 2 ) {
                        // 1 枚しかない場合は調節しない（横幅調整時、画面内に収まる時でも縦スクロールバーが出てしまうのを防ぐため）
                        return;
                    }
                    
                    var first_image = image_link_containers[ 0 ].querySelector( '.original-image' ),
                        first_element_top_offset = parseInt( getComputedStyle( image_overlay_container ).paddingTop ) + get_element_position( first_image ).y - get_element_position( image_overlay_image_container ).y,
                        maxHeight = w.innerHeight - first_element_top_offset - 4; // TODO: パディング分を自動で調整したい
                    
                    image_link_containers[ image_link_containers.length - 1 ].style.minHeight = maxHeight + 'px';
                } // end of adjust_last_image_link_container()
                
                
                function get_next_size( image_size ) {
                    if ( image_size_types[ image_size ] ) {
                        return image_size_types[ image_size ];
                    }
                    return OPTIONS.DEFAULT_IMAGE_SIZE;
                } // end of next_size()
                
                
                function change_size( next_size ) {
                    var width_max = 0,
                        all_image_loaded = true,
                        original_images = to_array( image_overlay_image_container.querySelectorAll( '.original-image' ) ),
                        image_link_containers =to_array( image_overlay_image_container.querySelectorAll( '.image-link-container' ) );
                    
                    image_overlay_container.style.overflowX = 'auto';
                    image_overlay_container.style.overflowY = 'auto';
                    
                    original_images.forEach( function ( img ) {
                        if ( ! get_natural_width( img ) ) {
                            all_image_loaded = false;
                        }
                        if ( width_max < get_natural_width( img ) ) {
                            width_max = get_natural_width( img );
                        }
                        
                        switch ( next_size ) {
                            case 'fit-width' :
                                img.style.width = 'auto';
                                img.style.height = 'auto';
                                img.style.maxWidth = '100%';
                                img.style.maxHeight = 'none';
                                break;
                            
                            case 'full' :
                                img.style.width = 'auto';
                                img.style.height = 'auto';
                                img.style.maxWidth = 'none';
                                img.style.maxHeight = 'none';
                                break;
                            
                            case 'fit-height' :
                                img.style.width = 'auto';
                                img.style.height = 'auto';
                                img.style.maxWidth = 'none';
                                img.style.maxHeight = 'none';
                                break;
                            
                            case 'fit-window' :
                                img.style.width = 'auto';
                                img.style.height = 'auto';
                                img.style.maxWidth = 'none';
                                img.style.maxHeight = 'none';
                                break;
                        }
                    } );
                    
                    image_link_containers.forEach( function ( image_link_container ) {
                        switch ( next_size ) {
                            case 'fit-width' :
                                image_link_container.style.width = 'auto';
                                image_link_container.style.height = 'auto';
                                break;
                            
                            case 'full' :
                                image_link_container.style.width = width_max + 'px';
                                image_link_container.style.height = 'auto';
                                break;
                            
                            case 'fit-height' :
                                image_link_container.style.width = 'auto';
                                image_link_container.style.height = 'auto';
                                break;
                            
                            case 'fit-window' :
                                image_link_container.style.width = 'auto';
                                image_link_container.style.height = 'auto';
                                break;
                        }
                    } );
                    
                    adjust_last_image_link_container();
                    
                    clear_node( help );
                    help.appendChild( d.createTextNode( OPTIONS.HELP_OVERLAY_SHORTCUT_SIZE + OPTIONS[ help_image_size_types[ next_size ] ] ) );
                    
                    image_size = next_size;
                    
                    fire_event( image_overlay_container, 'lock-mouseover' ); // current 要素を変更しないようにロックしておく
                    
                    setTimeout( function () {
                        switch ( image_size ) {
                            case 'fit-height' :
                                fire_event( image_overlay_container, 'image-fit-height' );
                                break;
                            
                            case 'fit-window' :
                                fire_event( image_overlay_container, 'image-fit-window' );
                                break;
                        }
                        fire_event( image_overlay_container, 'scroll-to-horizontal-middle' );
                        fire_event( image_overlay_container, 'scroll-to-current-image-container' );
                    }, 100 );
                    
                    if ( all_image_loaded ) {
                        switch ( image_size ) {
                            case 'fit-height' :
                                fire_event( image_overlay_container, 'image-fit-height' );
                                break;
                            
                            case 'fit-window' :
                                fire_event( image_overlay_container, 'image-fit-window' );
                                break;
                        }
                    }
                    
                    localStorage[ SCRIPT_NAME + '_saved_image_size' ] = image_size;
                    
                } // end of change_size()
                
                
                function toggle_image_size( event ) {
                    if ( first_event ) {
                        first_event = false;
                        change_size( image_size );
                    }
                    else {
                        change_size( get_next_size( image_size ) );
                    }
                } // end of toggle_image_size()
                
                return toggle_image_size;
            } )(); // end of toggle_image_size()
            
            
            var toggle_image_background_color = ( function () {
                var image_background_color_types = {
                        'black' : 'white'
                    ,   'white' : 'black'
                    },
                    saved_background_color = localStorage[ SCRIPT_NAME + '_saved_background_color' ],
                    image_background_color = ( image_background_color_types[ saved_background_color ] ) ? saved_background_color : OPTIONS.DEFAULT_IMAGE_BACKGROUND_COLOR,
                    help = import_node( help_item_template );
                
                help.classList.add( 'help-toggle-bgcolor' );
                
                add_event( help, 'click', function ( event ) {
                    event.stopPropagation();
                    event.preventDefault();
                    
                    fire_event( image_overlay_container, 'toggle-image-background-color' );
                    
                    return false;
                } );
                
                image_overlay_shortcut_help.appendChild( help );
                
                function change_background_color( background_color ) {
                    image_overlay_container.style.background = ( background_color == 'black' ) ? 'rgba( 0, 0, 0, 0.8 )' : 'rgba( 255, 255, 255, 0.8 )';
                    
                    to_array( image_overlay_image_container.querySelectorAll( '.original-image' ) ).forEach( function ( img ) {
                        img.style.background = background_color;
                    } );
                    
                    clear_node( help );
                    help.appendChild( d.createTextNode( OPTIONS.HELP_OVERLAY_SHORTCUT_BGCOLOR + OPTIONS[ ( background_color == 'black' ) ? 'HELP_OVERLAY_SHORTCUT_BGCOLOR_BLACK' : 'HELP_OVERLAY_SHORTCUT_BGCOLOR_WHITE' ] ) );
                    
                    image_background_color = background_color;
                    
                    localStorage[ SCRIPT_NAME + '_saved_background_color' ] = image_background_color;
                } // end of change_help()
                
                change_background_color( image_background_color );
                
                function toggle_image_background_color( event ) {
                    change_background_color( image_background_color_types[ image_background_color ] );
                } // end of toggle_image_background_color()
                
                return toggle_image_background_color;
            } )(); // end of toggle_image_background_color()
            
            
            event_list.push( { element : image_overlay_close_link, name : 'click', func : close_image_overlay_container } );
            event_list.push( { element : image_overlay_header, name : 'click', func : close_image_overlay_container } );
            event_list.push( { element : image_overlay_container, name : 'toggle-image-size', func : toggle_image_size } );
            event_list.push( { element : image_overlay_container, name : 'toggle-image-background-color', func : toggle_image_background_color } );
            add_events();
            
            if ( is_legacy_tweetdeck() ) {
                html_style.overflowX = 'hidden';
                html_style.overflowY = 'hidden';
                body_style.overflowX = 'hidden';
                body_style.overflowY = 'hidden';
                body_style.marginRight = 0;
            }
            else {
                /*
                //[2020.12] Twitter側の変更のためか、一番上にスクロールしてしまうようになってしまった
                //body_style.overflowX = 'hidden';
                //body_style.overflowY = 'hidden';
                //body_style.marginRight = 0;
                */
                html_style.overflowX = 'hidden';
                html_style.overflowY = 'hidden';
            }
            image_overlay_header_style.display = 'block';
            image_overlay_loading_style.display = 'block';
            image_overlay_container_style.display = 'block';
            
            image_overlay_drag_scroll.start();
            
        } // end of show_overlay()
        
        
        function open_page( img_urls, tweet_url, title ) {
            var is_complete = false,
                child_window_name = '_blank';
            
            if ( tweet_url ) {
                // window名定義 (同一ツイートのページについては、複数開かないようにする)
                child_window_name = SCRIPT_NAME + '_' + tweet_url.replace(/^.*\/(\d+)$/, '$1' );
                
                if ( opened_name_map[ child_window_name ] ) {
                    opened_name_map[ child_window_name ].close(); // 前面に出すため、同じ名前の window が開いていたら、一度閉じて開きなおす(※ window.focus()ではタブは前面に出てこない)
                    // TODO: Firefox(Greasemonkey) の場合には、これでも前面に出てこない場合有り(違うタブのタイムラインから、同一ツイートに対して操作した場合等)
                }
            }
            
            var child_window = w.open( 'about:blank', child_window_name ),
                child_document;
            
            opened_name_map[ child_window_name ] = child_window;
            
            function page_onload() {
                if ( is_complete ) {
                    return;
                }
                
                try {
                    child_document = child_window.document;
                }
                catch ( error ) {
                    log_error( 'cannot access document of child-window ', error );
                    // TODO: Firefox 68.0.1 では 「DOMException: "Permission denied to access property "document" on cross-origin object"」となってアクセスできない
                    return;
                }
                
                try {
                    child_document.open();
                    child_document.write( '<head></head><body></body>' );
                    child_document.close();
                }
                catch ( error ) {
                    //log_error( error ); // Firefox 43.0.4 (Greasemonkey): SecurityError: The operation is insecure.
                    // ※ Firefox(Greasemonkey) の場合、child_document.open() が SecurityError となってしまう
                    //    また、load された時点で、既に '<head></head><body></body>' になっている模様
                }
                
                var head = child_document.querySelector( 'head' ),
                    body = child_document.querySelector( 'body' ),
                    title_node = child_document.createElement( 'title' ),
                    title_text = OPTIONS.TITLE_PREFIX + ( ( title ) ? title : '' );
                
                body.style.background = '#f5f8fa';
                
                clear_node( title_node );
                title_node.appendChild( child_document.createTextNode( title_text ) );
                head.appendChild( title_node );
                
                if ( tweet_url ) {
                    var link = import_node( link_template, child_document ),
                        header = import_node( header_template, child_document );
                    
                    link.href = tweet_url;
                    link.appendChild( child_document.createTextNode( OPTIONS.TWEET_LINK_TEXT ) );
                    header.style.cssFloat = 'right';
                    header.appendChild( link );
                    body.appendChild( header );
                }
                
                add_images_to_page( img_urls, tweet_url, body, { document : child_document } );
                
                child_window.focus();
                
                is_complete = true;
            }
            
            if ( is_firefox() ) {
                // TODO: Firefox(Greasemonkey) で window.open() した後 document を書きかえるまでにウェイトをおかないとうまく行かない
                
                // TODO: ページが load された後でも書き換えがうまくいかない場合がある
                // - 一瞬書き換え結果の表示がされた後、空の("<head></head><body></body>"だけの)HTMLになったり、titleだけが書き換わった状態になったりする
                // - 元のページが固まってしまう場合がある
                // - Firefoxを再起動すると解消されたりと、結果が安定しない
                //add_event( child_window, 'load', function ( event ) {
                //    page_onload();
                //} );
                
                setTimeout( function () {
                    page_onload();
                }, OPTIONS.WAIT_AFTER_OPENPAGE );
            }
            else {
                page_onload();
            }
            
        } // end of open_page()
        
        
        function add_open_button( tweet ) {
            var tweet_container,
                gallery,
                old_button;
            
            
            function remove_old_button( old_button ) {
                if ( ! old_button ) {
                    return;
                }
                fire_event( old_button, 'remove-all-image-events' );
                if ( ! old_button.classList.contains( 'removed' ) ) {
                    old_button.classList.add( 'removed' );
                }
                if ( old_button.parentNode ) {
                    old_button.parentNode.removeChild( old_button );
                }
                old_button = null;
            } // end of remove_old_button()
            
            
            function get_img_number( img_object ) {
                var number,
                    offset;
                
                try {
                    number = parseInt( search_ancestor_by_attribute( img_object, 'href' ).href.replace( /^.*\/photo\//, '' ), 10 );
                    if ( is_react_page() ) {
                        //offset = ( search_ancestor_by_attribute( img_object, 'role', 'blockquote' ) ) ? 10 : 0;
                        offset = img_object.closest( 'div[role="link"], [role="blockquote"]' ) ? 10 : 0;
                    }
                    else {
                        offset = ( search_ancestor( img_object, [ 'js-quote-detail', 'quoted-tweet' ] ) ) ? 10 : 0;
                    }
                    return offset + number;
                }
                catch ( error ) {
                    return 0;
                }
            } // end of get_img_number()
            
            
            function get_img_objects( container ) {
                var img_objects = [];
                
                if ( is_react_page() ) {
                    img_objects = to_array( container.querySelectorAll( 'div[aria-label] > img[src*="//pbs.twimg.com/media/"]' ) ).filter( ( img_object ) => {
                        if ( OPTIONS.SHOW_IMAGES_OF_QUOTE_TWEET ) {
                            return true;
                        }
                        else {
                            // 引用ツイート中の画像は対象としない
                            //return ( ! search_ancestor_by_attribute( img_object, 'role', 'blockquote' ) );
                            return ( ! img_object.closest( 'div[role="link"], [role="blockquote"]' ) );
                        }
                    } ).sort( ( img_object1, img_object2 ) => {
                        var num1 = get_img_number( img_object1 ),
                            num2 = get_img_number( img_object2 );
                        
                        if ( num1 < num2 ) {
                            return -1;
                        }
                        else if ( num2 < num1 ) {
                            return 1;
                        }
                        return 0;
                    } );
                }
                else {
                    img_objects = to_array( container.querySelectorAll( '.AdaptiveMedia-photoContainer img, a.js-media-image-link img.media-img, div.js-media > div:not(.is-video) a.js-media-image-link[rel="mediaPreview"], .QuoteTweet .js-quote-photo > img' ) ).filter( ( img_object ) => {
                        if ( OPTIONS.SHOW_IMAGES_OF_QUOTE_TWEET ) {
                            return true;
                        }
                        else {
                            return ( ! search_ancestor( img_object, [ 'js-quote-detail', 'quoted-tweet', 'js-quote-photo' ] ) ); // 引用ツイート中の画像は対象としない
                        }
                    } );
                }
                return img_objects;
            } // end of get_img_objects()
            
            
            function get_img_url_from_background( element ) {
                var bgimage = element.style.backgroundImage;
                
                if ( ! bgimage || ! bgimage.match( /url\(['"\s]*(.*?)['"\s]*\)/ ) ) {
                    return null;
                }
                return RegExp.$1;
            } // end of get_img_url_from_background()
            
            
            function get_img_urls( img_objects ) {
                var img_urls = [];
                
                to_array( img_objects ).forEach( function ( img ) {
                    var img_url;
                    
                    if ( img.src ) {
                        img_url = get_img_url_orig( img.src );
                        
                        if ( ! /tweetdeck/.test( img_url ) ) {
                            if ( OPTIONS.SWAP_IMAGE_URL ) {
                                ( async () => {
                                    img.setAttribute( 'src', await find_valid_img_url( img_url ) );
                                } )();
                            }
                            img_urls.push( img_url );
                        }
                    }
                    else if ( img.href ) {
                        img_url = normalize_img_url( img.getAttribute( 'data-original-url' ) || get_img_url_from_background( img ) || img.href );
                        
                        if ( img_url && /\.(?:jpg|png|gif|webp)/.test( img_url ) ) {
                            img_url = get_img_url_orig( img_url );
                            if ( OPTIONS.SWAP_IMAGE_URL ) {
                                ( async () => {
                                    img.setAttribute( 'href', await find_valid_img_url( img_url ) );
                                } )();
                            }
                            img_urls.push( img_url );
                        }
                    }
                } );
                
                return img_urls;
            } // end of get_img_urls()
            
            
            tweet_container = ( is_legacy_tweetdeck() ) ? search_ancestor( tweet, [ 'js-stream-item' ] ) : null;
            if ( ! tweet_container ) {
                tweet_container = tweet;
            }
            
            if ( is_react_page() ) {
                // TODO: React 版 Twitter の Gallery 表示には未対応
                //gallery = d.querySelector( '[aria-labelledby="modal-header"]' );
            }
            else {
                gallery = ( is_legacy_tweetdeck() && tweet_container.classList.contains( 'js-stream-item' ) ) ? null : search_ancestor( tweet, [ 'Gallery', 'js-modal-panel' ] );
            }
            
            if ( gallery ) {
                old_button = gallery.querySelector( '.' + button_container_classname );
                remove_old_button( old_button );
                old_button = null;
            }
            
            old_button = tweet_container.querySelector( '.' + button_container_classname );
            
            if ( ! is_react_page() ) {
                remove_old_button( old_button );
            }
            
            var source_container = ( function () {
                    if ( ( ! is_legacy_tweetdeck() ) || ( ! gallery ) ) {
                        return tweet_container;
                    }
                    
                    var data_key_item = gallery.querySelector( '.js-tweet-box[data-key]' );
                    
                    if ( ! data_key_item ) {
                        return tweet_container;
                    }
                    
                    var source_container = d.body.querySelector( 'article.js-stream-item[data-key="' + data_key_item.getAttribute( 'data-key' ) + '"]' );
                        // TODO: TweetDeck の引用ツイートから直接ギャラリーを開いた場合は、source_container が取れない
                    
                    return ( source_container ) ? source_container : tweet_container;
                } )(),
                all_img_objects = get_img_objects( source_container ),
                video_objects = get_video_objects( source_container ),
                gallery_media = ( gallery ) ? gallery.querySelector( '.Gallery-media, .js-embeditem' ) : null,
                img_objects = ( gallery_media ) ? gallery_media.querySelectorAll( 'img.media-image, img.media-img, a.med-origlink[href^="https://ton.twitter.com"]' ) : null,
                action_list = ( gallery_media ) ? gallery_media.querySelector( '.js-media-preview-container' ) : null,
                img_urls = [],
                all_img_urls = [];
            
            if ( is_react_page() ) {
                if ( ! action_list ) {
                    if ( is_tweet_detail_on_react_twitter( tweet ) ) {
                        action_list = get_tweet_link_on_react_twitter( tweet );
                        if ( action_list ) {
                            action_list = action_list.parentNode;
                        }
                    }
                    else {
                        action_list = tweet_container.querySelector( '[role="group"]' );
                        if ( action_list ) {
                            if ( OPTIONS.DISPLAY_ORIGINAL_BUTTONS ) {
                                if ( is_react_tweetdeck() ) {
                                    action_list.style.flexWrap = 'wrap';
                                }
                                else {
                                    action_list.style.maxWidth = 'initial';
                                }
                            }
                        }
                    }
                }
            }
            else {
                action_list = ( action_list ) ? action_list : tweet_container.querySelector( '.ProfileTweet-actionList, footer' );
            }
            img_objects = ( img_objects && ( 0 < img_objects.length ) ) ? img_objects : all_img_objects;
            if ( ( ( img_objects.length <= 0 ) && ( video_objects.length <= 0 ) ) || ( ! action_list ) ) {
                return null;
            }
            
            img_urls = get_img_urls( img_objects );
            all_img_urls = get_img_urls( all_img_objects );
            
            if ( ( img_urls.length <= 0 ) && ( video_objects.length <= 0 ) ) {
                return null;
            }
            
            if ( all_img_urls.length < img_urls.length ) {
                // TODO: TweetDeck の引用ツイートから直接ギャラリーを開いたケースだと、TL上に元ツイートが無く、all_img_urls.length = 0 となってしまう
                all_img_urls = img_urls.slice( 0 );
            }
            
            var media_number = img_objects.length + video_objects.length;
            
            if ( is_react_page() && old_button ) {
                if ( old_button.getAttribute( 'data-image-number' ) == media_number ) {
                    log_debug( 'found old button and same image number', old_button );
                    return null;
                }
                log_debug( '*** found old button and different image number', old_button.getAttribute( 'data-image-number' ), '=>', media_number );
                remove_old_button( old_button );
            }
            
            
            function get_tweet_url_and_title() {
                var tweet_link,
                    tweet_url,
                    tweet_text,
                    title,
                    article;
                
                if ( is_react_page() ) {
                    tweet_link = get_tweet_link_on_react_twitter( tweet );
                    tweet_url = tweet_link && tweet_link.href;
                    if ( ! tweet_url ) {
                        try {
                            tweet_url = tweet.querySelector( 'a[role="link"][href$="/photo/1"]' ).href.replace( /\/photo\/1$/, '' );
                        }
                        catch ( error ) {
                            log_error( 'cannot find tweet_url in tweet element', tweet );
                        }
                    }
                    //tweet_text = tweet.querySelector( 'div[lang][dir="auto"] > span' );
                    tweet_text = tweet.querySelector( 'div[lang][dir="auto"]' );
                    if ( ! tweet_text ) {
                        article = search_ancestor_by_attribute( tweet, 'role', 'article' );
                        
                        if ( article ) {
                            //tweet_text = tweet.querySelector( 'div[lang][dir="auto"] > span' );
                            tweet_text = tweet.querySelector( 'div[lang][dir="auto"]' );
                        }
                    }
                }
                else {
                    tweet_link = tweet.querySelector( 'a[rel="url"][href^="https://x.com/"],a[rel="url"][href^="/"]' ); //twitter
                    tweet_url = tweet.getAttribute( 'data-permalink-path' ) || ( tweet_link && tweet_link.href );
                    tweet_text = tweet.querySelector( '.tweet-text,.js-tweet-text' );
                }
                //title = ( tweet_text ) ? ( ( tweet_text.innerText !== undefined ) ? tweet_text.innerText : tweet_text.textContent ) : '';
                title = ( tweet_text ) ? get_text_from_element( tweet_text ).trim() : '';
                
                return {
                    tweet_url : tweet_url,
                    title : title,
                };
            } // end of get_tweet_url_and_title()
            
            
            async function get_video_tweet_media_urls( tweet_url ) {
                // 動画を含む場合は API からメディア一覧(画像・動画・GIF)を取得
                var media_urls = await get_tweet_media_urls( get_tweet_id_from_tweet_url( tweet_url || '' ), OPTIONS.SHOW_IMAGES_OF_QUOTE_TWEET );
                
                if ( media_urls && ( 0 < media_urls.length ) ) {
                    return media_urls;
                }
                log_warn( 'media information not found:', tweet_url );
                
                // 取得できない場合は DOM の画像と GIF のみ(動画は blob: のため URL 不明)
                var gif_urls = video_objects.map( get_gif_url_from_video_object ).filter( ( gif_url ) => !! gif_url );
                
                if ( gif_urls.length < video_objects.length ) {
                    alert( OPTIONS.MEDIA_INFO_ERROR_TEXT );
                }
                media_urls = [];
                for ( const img_url of all_img_urls ) {
                    media_urls.push( await find_valid_img_url( img_url ) );
                }
                return media_urls.concat( gif_urls );
            } // end of get_video_tweet_media_urls()
            
            
            var button_container = button_container_template.cloneNode( true ),
                button = button_container.querySelector( 'button' );
            
            if ( is_react_page() ) {
                button_container.setAttribute( 'data-image-number', media_number );
                if ( is_react_tweetdeck() ) {
                }
                else {
                    button_container.style.cssFloat = 'right';
                }
                button.title = button_container.getAttribute( 'data-original-title' );
            }
            
            if ( ! OPTIONS.DISPLAY_ORIGINAL_BUTTONS ) {
                button_container.style.display = 'none';
            }
            
            if ( is_react_page() && OPTIONS.DOWNLOAD_HELPER_SCRIPT_IS_VALID && OPTIONS.DISPLAY_BULK_SELECT_BUTTONS ) {
                // 一括ダウンロード用の選択ボタン
                ( function () {
                    var tweet_id = get_tweet_id_from_tweet_url( get_tweet_url_and_title().tweet_url || '' ),
                        select_button;
                    
                    if ( ! tweet_id ) {
                        return;
                    }
                    select_button = d.createElement( 'button' );
                    select_button.className = 'btn';
                    select_button.style.marginLeft = '4px';
                    button_container.appendChild( select_button );
                    
                    bulk_download.bind_select_button( select_button, tweet_id, function () {
                        var url_and_title = get_tweet_url_and_title(),
                            author_info = get_tweet_author_info( tweet );
                        
                        return {
                            tweet_id : tweet_id,
                            tweet_url : url_and_title.tweet_url,
                            title : url_and_title.title,
                            fullname : author_info.fullname,
                            username : author_info.username,
                            timestamp_ms : author_info.timestamp_ms,
                            img_urls : all_img_urls.slice( 0 ),
                            gif_urls : video_objects.map( get_gif_url_from_video_object ).filter( ( gif_url ) => !! gif_url ),
                            video_number : video_objects.length,
                        };
                    } );
                } )();
            }
            
            add_event( button, 'click', function ( event ) {
                event.stopPropagation();
                
                const
                    button_loading_container_style = button.querySelector( '.loading' ).style,
                    alt_key_pushed = event.altKey || ( button.getAttribute( 'data-event-alt-key' ) == 'yes' ),
                    ctrl_key_pushed = event.ctrlKey || ( button.getAttribute( 'data-event-ctrl-key' ) == 'yes' ),
                    shift_key_pushed = event.shiftKey || ( button.getAttribute( 'data-event-shift-key' ) == 'yes' );
                
                let
                    focused_img_url = button.getAttribute( 'data-target-img-url' ),
                    target_img_urls = img_urls.slice( 0 ),
                    target_all_img_urls = all_img_urls.slice( 0 );
                
                button_loading_container_style.display = 'block';
                
                button.removeAttribute( 'data-target-img-url' );
                button.removeAttribute( 'data-event-alt-key' );
                button.removeAttribute( 'data-event-ctrl-key' );
                button.removeAttribute( 'data-event-shift-key' );
                
                if ( OPTIONS.DISPLAY_ALL_IN_ONE_PAGE ^ alt_key_pushed ) {
                    ( async () => {
                        if ( focused_img_url ) {
                            focused_img_url = await find_valid_img_url( focused_img_url );
                        }
                        for ( let ci = 0; ci < target_img_urls.length; ci ++ ) {
                            target_img_urls[ ci ] = await find_valid_img_url( target_img_urls[ ci ] );
                        }
                        for ( let ci = 0; ci < target_all_img_urls.length; ci ++ ) {
                            target_all_img_urls[ ci ] = await find_valid_img_url( target_all_img_urls[ ci ] );
                        }
                        
                        var url_and_title = get_tweet_url_and_title(),
                            tweet_url = url_and_title.tweet_url,
                            title = url_and_title.title;
                        
                        if ( 0 < video_objects.length ) {
                            const
                                media_urls = await get_video_tweet_media_urls( tweet_url );
                            
                            if ( media_urls.length <= 0 ) {
                                button_loading_container_style.display = 'none';
                                return;
                            }
                            target_img_urls = media_urls;
                            target_all_img_urls = media_urls.slice( 0 );
                        }
                        
                        button_loading_container_style.display = 'none';
                        
                        if ( OPTIONS.DISPLAY_OVERLAY || ( is_firefox() && is_extension() ) ) {
                            // TODO: Firefox 68.0.1 では about:blank の document が「DOMException: "Permission denied to access property "document" on cross-origin object"」となってアクセス不可のため、常にオーバーレイ表示
                            show_overlay( target_img_urls, tweet_url, title, focused_img_url, tweet, target_all_img_urls );
                        }
                        else {
                            open_page( ( focused_img_url ) ? [ focused_img_url ] : target_img_urls, tweet_url, title );
                        }
                    } )();
                }
                else {
                    const
                        open_target_tabs = ( target_img_urls ) => {
                            // TODO: 順に開くと最後の画像タブがアクティブになってしまう
                            if ( ( typeof extension_functions != 'undefined' ) && ( ! target_img_urls.some( ( img_url ) => is_video_url( img_url ) ) ) ) {
                                // 拡張機能の場合には chrome.tabs により制御(タブの並び替えは画像のみ対応)
                                extension_functions.open_multi_tabs( target_img_urls, ctrl_key_pushed );
                            }
                            else {
                                // 逆順にして、最初の画像がアクティブになるようにする
                                target_img_urls.reverse();
                                target_img_urls.forEach( function ( img_url, index ) {
                                    w.open( img_url, '_blank' );
                                } );
                            }
                        };
                    
                    if ( ( 0 < video_objects.length ) && ( ! focused_img_url ) ) {
                        ( async () => {
                            const
                                media_urls = await get_video_tweet_media_urls( get_tweet_url_and_title().tweet_url );
                            
                            button_loading_container_style.display = 'none';
                            open_target_tabs( media_urls );
                        } )();
                        return false;
                    }
                    
                    // [覚書] find_valid_img_url()してから画像を開くとボタンを押してから開くまでに顕著なタイムラグが出てしまう
                    // →ひとまずformat=webpだけはname=4096x4096で開いておき、開いた先でname=origにリダイレクト
                    if ( focused_img_url ) {
                        target_img_urls = [ focused_img_url ];
                    }
                    target_img_urls = target_img_urls.map( ( target_img_url ) => {
                        if ( get_img_extension( target_img_url ) == 'webp' ) {
                            target_img_url = target_img_url.replace( /name=orig/, 'name=4096x4096' ); // webpでもname=4096x4096ならば404にならずに開ける模様
                        }
                        return target_img_url;
                    } );
                    
                    var window_name = '_blank';
                    
                    open_target_tabs( target_img_urls );
                    button_loading_container_style.display = 'none';
                }
                return false;
            } );
            
            
            function insert_button( event ) {
                if ( action_list.querySelector( '.' + button_container_classname ) ) {
                    // TODO: タイミングによっては、ボタンが二重に表示されてしまう不具合対策
                    return;
                }
                button_container.classList.remove( 'removed' );
                
                if ( is_legacy_tweetdeck() ) {
                    if ( action_list.tagName == 'FOOTER' ) {
                        if ( search_ancestor( img_objects[ 0 ], [ 'js-tweet', 'tweet' ] ) ) {
                            button.style.marginTop = '0';
                            button.style.marginBottom = '8px';
                            action_list.insertBefore( button_container, action_list.firstChild );
                        }
                        else {
                            button.style.marginTop = '8px';
                            button.style.marginBottom = '0px';
                            action_list.appendChild( button_container );
                        }
                    }
                    else {
                        action_list.appendChild( button_container );
                    }
                }
                else {
                    var action_more = action_list.querySelector( '.ProfileTweet-action--more' );
                    
                    if ( action_more ) {
                        // 操作性のため、「その他」メニュー("float:right;"指定)よりも左側に挿入
                        action_list.insertBefore( button_container, action_more );
                    }
                    else {
                        action_list.appendChild( button_container );
                        
                        if ( is_react_tweetdeck() && action_list.querySelector( '[role="separator"]' ) ) {
                            button_container.style.marginTop = '4px';
                        }
                        else if ( is_react_twitter() ) {
                            var previous_element = button_container.previousSibling;
                            
                            if ( previous_element ) {
                                if ( ( previous_element.tagName == 'A' ) && ( previous_element.getAttribute( 'role' ) == 'link' ) ) {
                                    button.style.marginLeft = '8px';
                                }
                                else if ( previous_element.querySelector( 'svg' ) ) {
                                    button.style.marginLeft = '16px';
                                }
                            }
                        }
                    }
                }
            } // end of insert_button()
            
            add_event( button_container, 'reinsert', insert_button );
            
            var gif_players = [];
            
            if ( OPTIONS.OVERRIDE_CLICK_EVENT ) {
                if ( gallery_media && ( ! is_legacy_tweetdeck() ) ) {
                    // TODO: ナビが覆いかぶさっている(z-index:1)ため、手前に出して画像クリックイベントの方を優先化しているが、もっとスマートな方法は無いか？
                    //gallery_media.style.zIndex = 10;
                    //gallery_media.style.pointerEvents = 'none';
                    // →この設定だと、.Gallery-media を上に持ってくると、.GalleryTweet が隠れてしまう(マウスオーバしても表示されない)
                    
                    // 画像クリック用に、前後(prev/next)移動用のクリック範囲を絞って、真ん中を開けておく
                    gallery_media.style.cursor = 'pointer';
                    var nav_next = gallery_media.parentNode.querySelector( '.GalleryNav--next' );
                    if ( nav_next ) {
                        nav_next.style.width = '33%'; // 67% → 33% (画像クリック用に真ん中を空けておく）
                    }
                }
                
                to_array( img_objects ).forEach( function ( img ) {
                    if ( is_legacy_tweetdeck() && ( ! OPTIONS.OVERRIDE_GALLERY_FOR_TWEETDECK ) && ( ! gallery_media ) ) {
                        return;
                    }
                    
                    if ( img.classList.contains( SCRIPT_NAME + '_touched' ) ) {
                        fire_event( img, 'remove-image-events' );
                    }
                    
                    var open_target_image = ( function () {
                        var lock_event = false;
                        
                        function open_target_image( event ) {
                            if ( lock_event ) {
                                lock_event = false;
                                return;
                            }
                            
                            if ( ( event.shiftKey && event.altKey ) || event.ctrlKey ) {
                                // [Alt] / [option] キー押下時には、デフォルト動作を実施
                                lock_event = true;
                                event.preventDefault();
                                img.click();
                                return;
                            }
                            
                            event.stopPropagation();
                            event.preventDefault();
                            
                            button.setAttribute( 'data-event-alt-key', event.altKey ? 'yes' : 'no' );
                            button.setAttribute( 'data-event-ctrl-key', event.ctrlKey ? 'yes' : 'no' );
                            button.setAttribute( 'data-event-shift-key', event.shiftKey ? 'yes' : 'no' );
                            
                            if ( img.src ) {
                                button.setAttribute( 'data-target-img-url', get_img_url_orig( img.src ) );
                                button.click();
                            }
                            else if ( img.href ) {
                                var img_url = normalize_img_url( img.getAttribute( 'data-original-url' ) || get_img_url_from_background( img ) || img.href );
                                
                                if ( img_url && /\.(?:jpg|png|gif|webp)/.test( img_url ) ) {
                                    button.setAttribute( 'data-target-img-url', get_img_url_orig( img_url ) );
                                    button.click();
                                }
                            }
                            
                            return false;
                        } // end of open_target_image()
                        
                        return open_target_image;
                    } )(); // end of open_target_image()
                    
                    
                    function remove_image_events( event ) {
                        remove_event( img, 'remove-image-events', remove_image_events );
                        remove_event( img, 'click', open_target_image );
                        img.classList.remove( SCRIPT_NAME + '_touched' );
                    } // end of remove_image_events()
                    
                    
                    if ( ! has_some_classes( img, 'med-origlink' ) ) {
                        add_event( img, 'click', open_target_image );
                        add_event( img, 'remove-image-events', remove_image_events );
                    }
                    
                    if ( img.classList.contains( 'media-image' ) || is_react_page() ) {
                        img.style.pointerEvents = 'auto';
                    }
                    
                    img.classList.add( SCRIPT_NAME + '_touched' );
                } );
                
                // GIF もクリックでオーバーレイ表示(動画は X のプレイヤーをそのまま使用)
                video_objects.forEach( function ( video_object ) {
                    var gif_url = get_gif_url_from_video_object( video_object ),
                        player = get_video_player( video_object ) || video_object;
                    
                    if ( ! gif_url ) {
                        return;
                    }
                    
                    if ( player.classList.contains( SCRIPT_NAME + '_touched' ) ) {
                        fire_event( player, 'remove-image-events' );
                    }
                    
                    function open_target_gif( event ) {
                        if ( ( event.shiftKey && event.altKey ) || event.ctrlKey ) {
                            // デフォルト動作を実施
                            return;
                        }
                        
                        event.stopPropagation();
                        event.preventDefault();
                        
                        button.setAttribute( 'data-event-alt-key', event.altKey ? 'yes' : 'no' );
                        button.setAttribute( 'data-event-ctrl-key', event.ctrlKey ? 'yes' : 'no' );
                        button.setAttribute( 'data-event-shift-key', event.shiftKey ? 'yes' : 'no' );
                        button.setAttribute( 'data-target-img-url', gif_url );
                        button.click();
                        
                        return false;
                    } // end of open_target_gif()
                    
                    function remove_gif_events( event ) {
                        player.removeEventListener( 'click', open_target_gif, true );
                        remove_event( player, 'remove-image-events', remove_gif_events );
                        player.classList.remove( SCRIPT_NAME + '_touched' );
                    } // end of remove_gif_events()
                    
                    // プレイヤー上の要素(GIF表示等)のクリックも対象とするため capture で登録
                    player.addEventListener( 'click', open_target_gif, true );
                    add_event( player, 'remove-image-events', remove_gif_events );
                    player.classList.add( SCRIPT_NAME + '_touched' );
                    gif_players.push( player );
                } );
            }
            
            function remove_all_image_events( event ) {
                to_array( img_objects ).concat( gif_players ).forEach( function ( img ) {
                    fire_event( img, 'remove-image-events' );
                } );
            } // end of remove_all_image_events()
            
            add_event( button_container, 'remove-all-image-events', remove_all_image_events );
            
            insert_button();
            
            return button_container;
        } // end of add_open_button()
        
        return add_open_button;
    } )(); // end of add_open_button()
    
    
    function check_tweets( node ) {
        if ( ( ! node ) || ( node.nodeType != 1 ) ) {
            return false;
        }
        
        var tweet_list = [],
            tweet,
            ancestor;
        
        if ( is_react_page() ) {
            /*
            //if ( ! search_ancestor_by_attribute( node, 'data-testid', 'primaryColumn', true ) ) {
            //    return false;
            //}
            //tweet_list = to_array( node.querySelectorAll( 'div[data-testid="tweet"], article[data-testid="tweetDetail"]' ) );
            //// ※ [2019.08.07] article[data-testid="tweetDetail"] は無くなり、article[role="article"] に置き換わっている
            //
            //if ( 0 <= [ 'DIV', 'ARTICLE' ].indexOf( node.tagName ) ) {
            //    if ( 0 <= [ 'tweet', 'tweetDetail' ].indexOf( node.getAttribute( 'data-testid' ) ) ) {
            //        tweet_list.push( node );
            //    }
            //    else if ( ! has_some_classes( node, [ SCRIPT_NAME + 'Button' ] ) ) {
            //        tweet = search_ancestor_by_attribute( node, 'data-testid', [ 'tweet', 'tweetDetail' ] ) || search_ancestor_by_attribute( node, 'role', 'article' );
            //        
            //        if ( tweet ) {
            //            tweet_list.push( tweet );
            //        }
            //    }
            //}
            //tweet_list.forEach( function ( tweet ) {
            //    var article = search_ancestor_by_attribute( tweet, 'role', 'article' );
            //    
            //    if ( article ) {
            //        tweet = article;
            //    }
            //    add_open_button( tweet );
            //} );
            */
            const
               article_selector = is_react_tweetdeck() ? 'div[data-testid="cellInnerDiv"] article[role="article"]' : 'div[data-testid="primaryColumn"] article[role="article"]';
               
            tweet_list = to_array( node.querySelectorAll( article_selector ) ).filter( ( article ) => {
                if ( ( article.getAttribute( 'data-testid' ) == 'tweet' ) || article.querySelector( 'div[data-testid="tweet"]' ) ) {
                    if ( 0 < get_video_objects( article ).length ) {
                        // 動画・GIF を含む
                        return ( !! add_open_button( article ) );
                    }
                    if ( ( ! article.querySelector( 'div[aria-label] > img' ) ) || ( ! article.querySelector( 'a[role="link"][href$="/photo/1"]' ) ) ) {
                        return false;
                    }
                    return ( !! add_open_button( article ) );
                }
                return false;
            } );
            
            log_debug( '*** added button number: ', tweet_list.length );
        }
        else {
            tweet_list = to_array( node.querySelectorAll( 'div.js-stream-tweet, div.tweet, div.js-tweet' ) );
            
            if ( node.tagName == 'DIV' ) {
                if ( has_some_classes( node, [ 'js-stream-tweet', 'tweet', 'js-tweet' ] ) ) {
                    tweet_list.push( node );
                }
                else if ( ! has_some_classes( node, [ SCRIPT_NAME + 'Button' ] ) ) {
                    ancestor = has_some_classes( node, [ 'js-media-preview-container' ] ) && search_ancestor( node, [ 'js-modal-panel' ] );
                    
                    if ( ancestor ) {
                        tweet = ancestor.querySelector( 'div.js-stream-tweet, div.tweet, div.js-tweet' );
                        
                        if ( tweet ) {
                            tweet_list.push( tweet );
                        }
                    }
                }
            }
            tweet_list.forEach( function ( tweet ) {
                add_open_button( tweet );
            } );
        }
        
        log_debug(`tweet_list.length=${tweet_list.length}`);
        if ( tweet_list.length <= 0 ) {
            return false;
        }
        return true;
    } // end of check_tweets()
    
    
    function check_help_dialog( node ) {
        if ( ( ! node ) || ( node.nodeType != 1 ) ) {
            return false;
        }
        
        if ( is_react_page() ) {
            if ( ! /^\/i\/keyboard_shortcuts/.test( new URL( location.href ).pathname ) ) {
                return false;
            }
            
            /*
            ////var modal_header_h2_list = d.querySelectorAll( '[aria-labelledby="modal-header"] h2[data-testid="noRightControl"]' );
            //var modal_header_h2_list = d.querySelectorAll( '[aria-labelledby="modal-header"] h2[role="heading"][aria-level="2"]:not(#modal-header)' );
            //
            //if ( modal_header_h2_list.length < 1 ) {
            //    return false;
            //}
            //
            //var shortcut_parent = modal_header_h2_list[ modal_header_h2_list.length - 1 ].parentNode.parentNode;
            //
            */
            
            var shortcut_parents = d.querySelectorAll( '[aria-labelledby="modal-header"] ul[role="list"]' );
            
            if ( shortcut_parents.length <= 0 ) {
                return false;
            }
            
            var shortcut_parent = shortcut_parents[ shortcut_parents.length - 1 ];
            
            if ( shortcut_parent.querySelector( '.' + SCRIPT_NAME + '_key_help' ) ) {
                return false;
            }
            
            //var shorcut_list = shortcut_parent.querySelectorAll( ':scope > div' );
            var shorcut_list = shortcut_parent.querySelectorAll( ':scope > li[role="listitem"]' );
            
            if ( shorcut_list.length < 1 ) {
                return false;
            }
            
            var shortcut_container = shorcut_list[ shorcut_list.length - 1 ].cloneNode( true ),
                shortcut_header = shortcut_container.firstChild,
                shortcut_content_container = shortcut_container.lastChild,
                shortcut_content = shortcut_content_container.firstChild;
            
            shortcut_container.classList.add( SCRIPT_NAME + '_key_help' );
            shortcut_container.setAttribute( 'aria-label', OPTIONS.HELP_KEYPRESS_DISPLAY_IMAGES + ': ' + OPTIONS.HELP_KEYCHAR_DISPLAY_IMAGES.toUpperCase() );
            
            while ( 1 < shortcut_content_container.childNodes.length ) {
                shortcut_content_container.removeChild( shortcut_content_container.lastChild );
            }
            
            clear_node( shortcut_header );
            clear_node( shortcut_content );
            
            shortcut_header.appendChild( d.createTextNode( OPTIONS.HELP_KEYPRESS_DISPLAY_IMAGES ) );
            shortcut_content.appendChild( d.createTextNode( OPTIONS.HELP_KEYCHAR_DISPLAY_IMAGES.toUpperCase() ) );
            
            shortcut_parent.appendChild( shortcut_container );
        }
        else {
            var help_dialog = ( ( node.getAttribute( 'id' ) == 'keyboard-shortcut-dialog' ) || ( node.classList.contains( 'keyboard-shortcut-list-modal' ) ) ) ? node : node.querySelector( '.keyboard-shortcut-dialog, .keyboard-shortcut-list-modal' );
            
            if ( ( ! help_dialog ) || ( help_dialog.querySelector( '.' + SCRIPT_NAME + '_key_help' ) ) ) {
                return false;
            }
            
            if ( is_legacy_tweetdeck() ) {
                var keyboard_shortcut_list = help_dialog.querySelector( 'dl.keyboard-shortcut-list' ),
                    dd = d.createElement( 'dd' ),
                    //span = d.createElement( 'span' );
                    span = d.createElement( 'kbd' );
                
                span.className = 'text-like-keyboard-key';
                span.appendChild( d.createTextNode( OPTIONS.HELP_KEYCHAR_DISPLAY_IMAGES.toUpperCase() ) );
                dd.className = 'keyboard-shortcut-definition';
                dd.appendChild( span );
                dd.appendChild( d.createTextNode( ' ' + OPTIONS.HELP_KEYPRESS_DISPLAY_IMAGES ) );
                
                keyboard_shortcut_list.appendChild( dd );
            }
            else {
                var modal_table_tbody = help_dialog.querySelector( 'table.modal-table tbody' ),
                    tr_template = modal_table_tbody.querySelectorAll( 'tr' )[0],
                    tr = tr_template.cloneNode( true ),
                    shortcut_key = tr.querySelector( '.shortcut .sc-key' ),
                    shortcut_label = tr.querySelector( '.shortcut-label' );
                
                tr.classList.add( SCRIPT_NAME + '_key_help' );
                
                clear_node( shortcut_key );
                clear_node( shortcut_label );
                
                shortcut_key.appendChild( d.createTextNode( OPTIONS.HELP_KEYCHAR_DISPLAY_IMAGES ) );
                shortcut_label.appendChild( d.createTextNode( OPTIONS.HELP_KEYPRESS_DISPLAY_IMAGES ) );
                
                modal_table_tbody.appendChild( tr );
            }
        }
        
        return true;
    } // end of check_help_dialog()
    
    
    function update_display_mode() {
        if ( is_night_mode() ) {
            d.body.setAttribute( 'data-nightmode', 'true' );
        }
        else {
            d.body.setAttribute( 'data-nightmode', 'false' );
        }
    } // end of update_display_mode()
    
    
    function start_mutation_observer() {
        var observer = new MutationObserver( function ( records ) {
                if ( ! is_valid_url() ) { // ※ History API によりページ遷移無しで移動する場合もあるので毎回チェック
                    return;
                }
                
                update_display_mode();
                
                stop_observe();
                
                try {
                    if ( is_react_page() ) {
                        check_tweets( d.body );
                        check_help_dialog( d.body );
                    }
                    else {
                        records.forEach( function ( record ) {
                            var target = record.target;
                                            
                            if ( is_legacy_tweetdeck() ) {
                                to_array( record.removedNodes ).forEach( function ( removedNode ) {
                                    if ( removedNode.nodeType != 1 ) {
                                        return;
                                    }
                                    if ( ! removedNode.classList.contains( 'removed' ) ) {
                                        // TweetDeck でユーザーをポップアップ→USERS・MENTIONS等のタイムラインを表示したとき、一度挿入したボタンが削除されることがある→再挿入
                                        fire_event( removedNode, 'reinsert' );
                                    }
                                    
                                    if ( removedNode.classList.contains( 'js-media' ) ) {
                                        // TweetDeck でメディア(サムネイル)だけが削除→挿入される場合がある
                                    }
                                } );
                            }
                            // ※ addedNodes よりも removedNodes を先に処理しないと、ボタンの存在チェック等で誤動作することがある
                            
                            to_array( record.addedNodes ).forEach( function ( addedNode ) {
                                if ( addedNode.nodeType != 1 ) {
                                    return;
                                }
                                if ( check_tweets( addedNode ) ) {
                                    return;
                                }
                                if ( check_help_dialog( addedNode ) ) {
                                    return;
                                }
                                
                                if ( is_legacy_tweetdeck() ) {
                                    if ( addedNode.classList.contains( 'js-media' ) ) {
                                        // TweetDeck でメディア(サムネイル)だけが削除→挿入される場合がある
                                        var ancestor = search_ancestor( addedNode, [ 'js-stream-tweet', 'tweet', 'js-tweet' ] );
                                        
                                        if ( ancestor ) {
                                            check_tweets( ancestor );
                                        }
                                        return;
                                    }
                                }
                            } );
                        } );
                    }
                }
                finally {
                    start_observe();
                }
            } ),
            
            start_observe = () => observer.observe( d.body, { childList : true, subtree : true } ),
            
            stop_observe = () => observer.disconnect();
        
        start_observe();
        
    } // end of start_mutation_observer()
    
    
    function get_visible_overlay_container() {
        var image_overlay_container = d.querySelector( '#' + SCRIPT_NAME + '_image_overlay_container' );
        
        return ( image_overlay_container && image_overlay_container.style.display != 'none' ) ? image_overlay_container : null;
        
    } // end of get_visible_overlay_container()
    
    
    function close_overlay() {
        var image_overlay_container = get_visible_overlay_container();
        
        if ( ! image_overlay_container ) {
            return false;
        }
        
        var image_overlay_close_link = d.querySelector( '#' + SCRIPT_NAME + '_image_overlay_header a.' + SCRIPT_NAME + '_close_overlay' );
            
        if ( ! image_overlay_close_link ) {
            return false;
        }
        
        image_overlay_close_link.click();
        
        return true;
    } // end of close_overlay()
    
    
    function view_images_on_keypress( event ) {
        if ( close_overlay() ) {
            event.stopPropagation();
            event.preventDefault();
            
            return false;
        }
        
        function get_button( ancestor ) {
            return ( ancestor ) ? ancestor.querySelector( '.' + SCRIPT_NAME + 'Button button' ) : null;
        } // end of get_button()
        
        var gallery,
            target_tweet,
            button;
        
        if ( is_react_tweetdeck() ) {
            target_tweet = d.querySelector( 'article[role="article"][data-testid="tweet"][data-focusvisible-polyfill="true"]' );
            if ( target_tweet ) {
                button = get_button( target_tweet );
            }
        }
        else if ( is_react_twitter() ) {
            // TODO: React 版 Twitter の Gallery 表示には未対応
            gallery = d.querySelector( '[aria-labelledby="modal-header"]' );
            var region = d.querySelector( 'main[role="main"] [data-testid="primaryColumn"] section[role="region"]' );
            
            if ( region ) {
                //target_tweet = region.querySelector( '.rn-errtx7' ) || region.querySelector( 'article[role="article"] [data-testid="tweet"]' ) || region.querySelector( 'article[role="article"][data-testid="tweetDetail]' );
                target_tweet = region.querySelector( 'article[role="article"][data-focusvisible-polyfill="true"]' );
                
                if ( ! target_tweet ) {
                    //target_tweet = region.querySelector( 'article[role="article"] [data-testid="tweet"]' );
                    target_tweet = region.querySelector( '[data-focusvisible-polyfill="true"]' );
                    if ( ! target_tweet ) {
                        var tweet_id = get_tweet_id_from_tweet_url( location.href );
                        if ( tweet_id ) {
                            target_tweet = region.querySelector( 'a[role="link"][href$="' + tweet_id + '"]' );
                        }
                        if ( ! target_tweet ) {
                            target_tweet = region.querySelector( 'article[role="article"][data-testid="tweet"], article[role="article"] [data-testid="tweet"]' );
                        }
                    }
                    if ( target_tweet ) {
                        target_tweet = search_ancestor_by_attribute( target_tweet, 'role', 'article', true );
                    }
                }
                button = get_button( target_tweet );
            }
        }
        else {
            gallery = d.querySelector( '.Gallery, .js-modal-panel' );
            target_tweet = ( gallery && w.getComputedStyle( gallery ).display != 'none' ) ? gallery.querySelector( 'div.js-stream-tweet, div.tweet, div.js-tweet' ) : null;
            button = get_button( ( gallery && gallery.classList.contains( 'js-modal-panel' ) ) ? gallery : target_tweet );
            
            if ( ( ! target_tweet ) || ( ! button ) ) {
                target_tweet = d.querySelector( '.selected-stream-item div.js-stream-tweet, .selected-stream-item div.tweet, .is-selected-tweet div.tweet, .is-selected-tweet div.js-tweet' );
                button = get_button( target_tweet );
            }
            if ( ( ! target_tweet ) || ( ! button ) ) {
                target_tweet = d.querySelector( '.permalink-tweet' );
                button = get_button( target_tweet );
            }
        }
        
        if ( ( ! target_tweet ) || ( ! button ) ) {
            return;
        }
        
        event.stopPropagation();
        event.preventDefault();
        
        button.setAttribute( 'data-event-alt-key', event.altKey ? 'yes' : 'no' );
        button.setAttribute( 'data-event-ctrl-key', event.ctrlKey ? 'yes' : 'no' );
        button.setAttribute( 'data-event-shift-key', event.shiftKey ? 'yes' : 'no' );
        button.click();
        
        return false;
    } // end of view_images_on_keypress()
    
    
    function close_overlay_on_keypress( event ) {
        if ( ! close_overlay() ) {
            return;
        }
        
        event.stopPropagation();
        event.preventDefault();
        
        return false;
    } // end of close_overlay_on_keypress()
    
    
    function check_overlay_key_event( key_code, event ) {
        var image_overlay_container = get_visible_overlay_container();
        
        if ( ! image_overlay_container ) {
            return false;
        }
        
        if ( event.ctrlKey || event.altKey ) {
            return false;
        }
        
        var is_valid_key = true;
        
        switch ( key_code ) {
            case 13 : // [Enter]
            case 32 : // [Space]
                if ( event.shiftKey ) {
                    fire_event( image_overlay_container, 'page-up' );
                }
                else {
                    fire_event( image_overlay_container, 'page-down' );
                }
                break;
            case 74 : // [j]
                fire_event( image_overlay_container, 'image-next' );
                break;
            case 75 : // [k]
                fire_event( image_overlay_container, 'image-prev' );
                break;
            case 68 : // [d]
                fire_event( image_overlay_container, 'download-image' );
                break;
            case 90 : // [z]
                fire_event( image_overlay_container, 'download-image-zip' );
                break;
            case 83 : // [s]
            case 87 : // [w] (互換性のため残す)
                fire_event( image_overlay_container, 'toggle-image-size' );
                break;
            case 66 : // [b]
                fire_event( image_overlay_container, 'toggle-image-background-color' );
                break;
            case 38 : // [↑]
                fire_event( image_overlay_container, 'scroll-up' );
                break;
            case 40 : // [↓]
                fire_event( image_overlay_container, 'scroll-down' );
                break;
            case 37 : // [←]
                fire_event( image_overlay_container, 'scroll-left' );
                break;
            case 39 : // [→]
                fire_event( image_overlay_container, 'scroll-right' );
                break;
            case 36 : // [Home]
                fire_event( image_overlay_container, 'smooth-scroll-to-top' );
                break;
            case 35 : // [End]
                fire_event( image_overlay_container, 'smooth-scroll-to-bottom' );
                break;
            default :
                if ( 
                    ( 65 <= key_code && key_code <= 90 ) || // [A-Za-z]
                    ( 48 <= key_code && key_code <= 57 ) || // [0-9]
                    ( 188 <= key_code && key_code <= 191 ) // [,\-./<>?]
                ) {
                    // オーバーレイ表示中は、標準のショートカットキーを無効化
                    break;
                }
                is_valid_key = false;
                break;
        }
        
        if ( is_valid_key ) {
            event.stopPropagation();
            event.preventDefault();
        }
        return is_valid_key;
        
    } // end of check_overlay_key_event()
    
    
    function start_key_observer() {
        function is_valid( active_element ) {
            if ( 
                ( ( ( active_element.classList.contains( 'tweet-box' ) ) || ( active_element.getAttribute( 'role' ) == 'textbox' ) || ( active_element.getAttribute( 'name' ) == 'tweet' ) ) && ( active_element.getAttribute( 'contenteditable' ) == 'true' ) ) ||
                ( active_element.tagName == 'TEXTAREA' ) ||
                ( ( active_element.tagName == 'INPUT' ) && ( 0 <= [ 'TEXT', 'PASSWORD' ].indexOf( active_element.getAttribute( 'type' ).toUpperCase() ) ) )
            ) {
                return false;
            }
            return true;
        } // end of is_valid()
        
        add_event( d.body, 'keypress', function ( event ) {
            var active_element = d.activeElement;
            
            if ( ! is_valid( active_element ) ) {
                return;
            }
            
            var key_code = event.which;
            
            switch ( key_code ) {
                default :
                    var image_overlay_container = get_visible_overlay_container();
                    
                    if ( ! image_overlay_container ) {
                        break;
                    }
                    
                    if (
                        ( 65 <= key_code && key_code <= 90 ) || // [A-Z]
                        ( 97 <= key_code && key_code <= 122 ) || // [a-z]
                        ( 48 <= key_code && key_code <= 57 ) || // [0-9]
                        ( 44 <= key_code && key_code <= 47 ) || // [,\-./]
                        ( 60 <= key_code && key_code <= 63 ) // [<=>?]
                    ) {
                        // オーバーレイ表示中は、標準のショートカットキーを無効化
                        event.stopPropagation();
                        event.preventDefault();
                    }
                    break;
            }
        } );
        
        add_event( d.body, 'keydown', function ( event ) {
            var active_element = d.activeElement;
            
            if ( ! is_valid( active_element ) ) {
                return;
            }
            
            var key_code = event.keyCode;
            
            switch ( key_code ) {
                case OPTIONS.KEYCODE_DISPLAY_IMAGES :
                    return view_images_on_keypress( event );
                
                case OPTIONS.KEYCODE_CLOSE_OVERLAY :
                    return close_overlay_on_keypress( event );
                
                default :
                    if ( check_overlay_key_event( key_code, event ) ) {
                        return false;
                    }
                    break;
            }
        } );
        
    } // end of start_key_observer()
    
    
    function start_mouse_observer() {
        function check_obstacling_node( node ) {
            if ( ( ! node ) || ( node.nodeType != 1 ) ) {
                return;
            }
            if ( node.classList.contains( 'GalleryNav' ) || node.classList.contains( 'media-overlay' ) ) {
                // ギャラリー表示等の際にナビが画像にかぶさっており、コンテキストメニューから画像を保存できない場合がある
                // → コンテキストメニューを表示する際に少しの時間だけナビを隠すことで対応
                //    ※ Google Chrome 48.0.2564.97 m と Opera 34.0.2036.50 は OK、Firefox 44.0 はNG
                //       Firefox ではおそらく、スクリプトがイベントを処理するよりも、コンテキストメニューが開く方が早い
                var original_style_display = node.style.display;
                
                node.style.display = 'none';
                setTimeout( function () {
                    node.style.display = original_style_display;
                }, 100 );
            }
            
        } // end of check_obstacling_node()
        
        
        add_event( d, 'contextmenu', function ( event ) {
            check_obstacling_node( event.target );
        } );
    
    } // end of start_mouse_observer()
    
    
    function insert_css( css_rule_text ) {
        var parent = d.querySelector( 'head' ) || d.body || d.documentElement,
            css_style = d.createElement( 'style' ),
            css_rule = d.createTextNode( css_rule_text );
        
        css_style.type = 'text/css';
        css_style.className = SCRIPT_NAME + '-css-rule';
        
        if ( css_style.styleSheet ) {
            css_style.styleSheet.cssText = css_rule.nodeValue;
        }
        else {
            css_style.appendChild( css_rule );
        }
        
        parent.appendChild( css_style );
    } // end of insert_css()
    
    
    function set_user_css() {
        var button_selector = '.' + SCRIPT_NAME + 'Button button.btn',
            css_rule_lines = [
                button_selector + '{padding:2px 6px; font-weight:normal; min-height:16px; white-space:nowrap;}'
            ];
        
        if ( is_react_tweetdeck() ) {
            css_rule_lines.push( button_selector + '{margin: 8px 0 8px 0; padding: 0 8px; border: solid 1px #1da1f2; border-radius: 12px; font-size: 11px; color: #1da1f2; background-color: transparent; cursor: pointer;}' );
            css_rule_lines.push( 'html.dark ' + button_selector + ', #open-modal ' + button_selector + '{background: transparent;}' );
            css_rule_lines.push( 'html.dark ' + button_selector + ':hover, #open-modal ' + button_selector + ':hover{background: #183142;}' );
        }
        else if ( is_legacy_tweetdeck() ) {
            css_rule_lines.push( button_selector + '{margin: 8px 0 8px 0; padding: 0 8px; border-radius: 12px; font-size: 11px;}' );
            css_rule_lines.push( 'html.dark ' + button_selector + ', #open-modal ' + button_selector + '{background: transparent;}' );
            css_rule_lines.push( 'html.dark ' + button_selector + ':hover, #open-modal ' + button_selector + ':hover{background: #183142;}' );
        }
        else {
            css_rule_lines.push( button_selector + '{font-size: 12px;}' );
            // TODO: [夜間モード対応] TweetDeck の場合 html.dark で判別がつく一方、Twitter の場合 CSS ファイルそのものを入れ替えている→ CSSルールでの切替困難
            
            if ( is_react_page() ) {
                css_rule_lines.push( button_selector + '{background-image: linear-gradient(rgb(255, 255, 255), rgb(245, 248, 250)); background-color: rgb(245, 248, 250); color: rgb(102, 117, 127); cursor: pointer; display: inline-block; position: relative; border-width: 1px; border-style: solid; border-color: rgb(230, 236, 240); border-radius: 4px;}' );
                css_rule_lines.push( button_selector + ':hover {color: rgb(20, 23, 26); background-color: rgb(230, 236, 240); background-image: linear-gradient(rgb(255, 255, 255), rgb(230, 236, 240)); text-decoration: none; border-color: rgb(230, 236, 240);}' );
                css_rule_lines.push( 'body[data-nightmode="true"] ' + button_selector + '{background-color: #182430; background-image: none; border: 1px solid #38444d; border-radius: 4px; color: #8899a6; display: inline-block;}' );
                css_rule_lines.push( 'body[data-nightmode="true"] ' + button_selector + ':hover {color: #fff; text-decoration: none; background-color: #10171e; background-image: none; border-color: #10171e;}' );
            }
        }
        
        to_array( d.querySelectorAll( 'style.' + SCRIPT_NAME + '-css-rule' ) ).forEach( function ( old_style_css_rull ) {
            old_style_css_rull.parentNode.removeChild( old_style_css_rull );
        } );
        
        insert_css( css_rule_lines.join( '\n' ) );
    
    } // end of set_user_css()
    
    
    function main() {
        // 適用する CSS を挿入
        set_user_css();
        
        // 新規に挿入されるツイートの監視開始
        start_mutation_observer();
        
        // 最初に表示されているすべてのツイートをチェック
        if ( is_valid_url() ) {
            update_display_mode();
            check_tweets( d.body );
        }
        
        // キー入力の監視開始
        start_key_observer();
        
        // マウスの監視開始
        start_mouse_observer();
        
    } // end of main()
    
    main();
    
} // end of initialize()


function gm_xhr_promise( details ) {
    if ( ! details ) {
        details = {};
    }
    
    details = Object.assign( {
        method : 'GET',
        timeout : 10000,
        responseType : 'json',
    }, details );
    
    return new Promise( ( resolve, reject ) => {
        Object.assign( details, {
            onload : resolve,
            onerror : reject,
            ontimeout : reject,
        } );
        GM_xmlhttpRequest(details);
    } );
} // end of gm_xhr_promise();


async function init_gm_menu() {
    var user_options = Object.create( null ),
        language = ( () => {
            return [ 'ja', 'en' ].includes( LANGUAGE ) ? LANGUAGE : 'en';
        } )(),
        messages = await gm_xhr_promise( {
            url : 'https://furyutei.github.io/twOpenOriginalImage/src/_locales/' + language + '/messages.json',
        } )
        .then( response => {
            var message_map =  response.response;
            
            return Object.keys( message_map ).reduce( ( messages, key ) => {
                messages[ key ] = message_map[ key ].message;
                return messages;
            }, {} );
        } )
        .catch( error => {
            return null;
        } );
    
    if ( messages === null ) {
        return user_options;
    }
    
    var config_id = `${SCRIPT_NAME}Config`,
        open_value_map,
        saved_value_map,
        
        get_config_value_map = ( getLive = false ) => Object.keys( GM_config.fields ).reduce( ( value_map, field_id ) => {
            if ( GM_config.fields[ field_id ].save === false ) {
                return value_map;
            }
            value_map[ field_id ] = GM_config.get( field_id, getLive );
            return value_map;
        }, Object.create( null ) ),
        
        get_diff_values = ( value_map1, value_map2 ) => {
            if ( ! value_map1 ) {
                value_map1 = Object.create( null );
            }
            if ( ! value_map2 ) {
                value_map2 = Object.create( null );
            }
            return Object.keys( GM_config.fields ).reduce( ( values, field_id ) => {
                if ( GM_config.fields[ field_id ].save === false ) {
                    return values;
                }
                var value1 = value_map1[ field_id ],
                    value2 = value_map2[ field_id ];
                
                if ( value1 !== value2 ) {
                    values.push( {
                        field_id,
                        value1,
                        value2,
                    } );
                }
                return values;
            }, [] );
        },
        
        update_save_status = () => {
            var save_status = ( GM_config.frame.contentDocument || GM_config.frame.ownerDocument ).querySelector( `#${config_id}_save-status` ),
                current_value_map = get_config_value_map( true );
            
            if ( 0 < get_diff_values( saved_value_map, current_value_map ).length ) {
                save_status.textContent = messages.NOT_SAVED;
                save_status.classList.add( 'warning' );
            }
            else {
                save_status.textContent = '';
                save_status.classList.remove( 'warning' );
            }
        };
    
    switch ( language ) {
        case 'ja' :
            Object.assign( messages, {
                SETTINGS : '設定',
                CONTROL : '制御',
                SAVE : '保存',
                CLOSE : '閉じる',
                SET_DEFAULT : 'デフォルトに戻す',
                OPERATION : `${messages.ext_title}稼働`,
                NOT_SAVED : '未保存',
            } );
            break;
        
        default :
            Object.assign( messages, {
                SETTINGS : 'Settings',
                CONTROL : 'Control',
                SAVE : 'Save',
                CLOSE : 'Close',
                SET_DEFAULT : 'Reset to defaults',
                OPERATION : `Running ${messages.ext_title}`,
                NOT_SAVED : 'Not saved',
            } );
            break;
    }
    
    GM_config.init( {
        id : config_id,
        title : `${messages.ext_title} version ${GM_info.script.version}`,
        fields : {
            DEFAULT_ACTION_ON_CLICK_EVENT : {
                label : messages.DEFAULT_ACTION_ON_CLICK_EVENT,
                type : 'radio',
                options : [
                    messages.DISPLAY_ALL_IN_ONE_PAGE_DESCRIPTION,
                    messages.DISPLAY_ONE_PER_PAGE_DESCRIPTION,
                ],
                default : messages.DISPLAY_ALL_IN_ONE_PAGE_DESCRIPTION,
                save : false,
                section : messages.SETTINGS,
            },
            
            DISPLAY_ALL_IN_ONE_PAGE : {
                type : 'checkbox',
                default : OPTIONS.DISPLAY_ALL_IN_ONE_PAGE,
            },
            
            DISPLAY_OVERLAY : {
                label : messages.DISPLAY_OVERLAY,
                type : 'checkbox',
                default : OPTIONS.DISPLAY_OVERLAY,
            },
            
            OVERRIDE_CLICK_EVENT : {
                label : messages.OVERRIDE_CLICK_EVENT,
                type : 'checkbox',
                default : OPTIONS.OVERRIDE_CLICK_EVENT,
            },
            
            SWAP_IMAGE_URL : {
                label : messages.SWAP_IMAGE_URL,
                type : 'checkbox',
                default : OPTIONS.SWAP_IMAGE_URL,
            },
            
            DISPLAY_ORIGINAL_BUTTONS : {
                label : messages.DISPLAY_ORIGINAL_BUTTONS,
                type : 'checkbox',
                default : OPTIONS.DISPLAY_ORIGINAL_BUTTONS,
            },
            
            BUTTON_TEXT : {
                label : messages.BUTTON_TEXT_HEADER,
                type : 'text',
                default : OPTIONS.BUTTON_TEXT,
            },
            
            ENABLED_ON_TWEETDECK : {
                label : messages.ENABLED_ON_TWEETDECK,
                type : 'checkbox',
                default : OPTIONS.ENABLED_ON_TWEETDECK,
            },
            
            OVERRIDE_GALLERY_FOR_TWEETDECK : {
                label : messages.OVERRIDE_GALLERY_FOR_TWEETDECK,
                type : 'checkbox',
                default : OPTIONS.OVERRIDE_GALLERY_FOR_TWEETDECK,
            },
            
            DOWNLOAD_HELPER_SCRIPT_IS_VALID : {
                label : messages.DOWNLOAD_HELPER_IS_VALID_HEADER,
                type : 'checkbox',
                default : OPTIONS.DOWNLOAD_HELPER_SCRIPT_IS_VALID,
            },
            
            HIDE_DOWNLOAD_BUTTON_AUTOMATICALLY : {
                label : messages.HIDE_DOWNLOAD_BUTTON_AUTOMATICALLY,
                type : 'checkbox',
                default : OPTIONS.HIDE_DOWNLOAD_BUTTON_AUTOMATICALLY,
            },
            
            SAME_FILENAME_AS_IN_ZIP : {
                label : messages.SAME_FILENAME_AS_IN_ZIP,
                type : 'checkbox',
                default : OPTIONS.SAME_FILENAME_AS_IN_ZIP,
            },
            
            SUPPRESS_FILENAME_SUFFIX : {
                label : messages.SUPPRESS_FILENAME_SUFFIX,
                type : 'checkbox',
                default : OPTIONS.SUPPRESS_FILENAME_SUFFIX,
            },
            
            OPERATION : {
                label : messages.OPERATION,
                type : 'checkbox',
                default : OPTIONS.OPERATION,
                section : messages.CONTROL,
            },
        },
        events : {
            init : function () {
                GM_config.set( 'DEFAULT_ACTION_ON_CLICK_EVENT', GM_config.get( 'DISPLAY_ALL_IN_ONE_PAGE' ) ? messages.DISPLAY_ALL_IN_ONE_PAGE_DESCRIPTION : messages.DISPLAY_ONE_PER_PAGE_DESCRIPTION );
            },
            
            open : function ( frame_doc, frame_win, frame ) {
                saved_value_map = open_value_map = get_config_value_map();
                
                frame.style.border = 'none';
                frame.style.zIndex = 99999;
                
                GM_config.fields[ 'DEFAULT_ACTION_ON_CLICK_EVENT' ].node.addEventListener( 'change', event => {
                    GM_config.set( 'DISPLAY_ALL_IN_ONE_PAGE', GM_config.get( 'DEFAULT_ACTION_ON_CLICK_EVENT', true ) == messages.DISPLAY_ALL_IN_ONE_PAGE_DESCRIPTION );
                }, false );
                
                if ( is_firefox() ) {
                    GM_config.fields[ 'DISPLAY_OVERLAY' ].node.setAttribute( 'disabled', 'disabled' );
                }
                
                var config_header = frame_doc.querySelector( `#${config_id}_header` ),
                    header_link = frame_doc.createElement( 'a' );
                    //donation_link = frame_doc.createElement( 'a' );
                
                header_link.id = `${config_id}_header-title-link`;
                header_link.textContent = config_header.textContent;
                header_link.target = '_blank';
                header_link.href = GM_info.script.homepage || 'https://github.com/pulsekinesis/X-View-Original-Images';
                
                // donation_link.textContent = messages.DOMATION;
                // donation_link.id = `${config_id}_header-donation-link`;
                // donation_link.target = '_blank';
                // donation_link.href = 'https://memo.furyutei.com/about#send_donation';
                
                //config_header.classList.remove( 'center' );
                config_header.textContent = '';
                config_header.appendChild( header_link );
                config_header.appendChild( donation_link );
                
                var save_button = frame_doc.querySelector( `#${config_id}_saveBtn` ),
                    close_button = frame_doc.querySelector( `#${config_id}_closeBtn` ),
                    reset_link = frame_doc.querySelector( `#${config_id}_resetLink` ),
                    save_status = frame_doc.createElement( 'span' );
                
                save_status.id = `${config_id}_save-status`;
                save_status.textContent = '';
                
                save_button.parentNode.insertBefore( save_status, save_button );
                save_button.textContent = messages.SAVE;
                close_button.textContent = messages.CLOSE;
                reset_link.textContent = messages.SET_DEFAULT;
                
                [ ... frame_doc.querySelectorAll( '.section_header' ) ].map( section_header => section_header.classList.remove( 'center' ) );
                
                [ ... frame_doc.querySelectorAll( 'input[type="radio"]' ) ].map( radio_element => {
                    var next_element = radio_element.nextElementSibling;
                    if ( next_element && next_element.tagName == 'LABEL' ) {
                        next_element.insertBefore( radio_element, next_element.firstChild );
                    }
                } );
                
                frame_doc.addEventListener( 'keydown', event => {
                    switch ( event.keyCode ) {
                        case 83 : { // [s]
                            if ( ! event.ctrlKey ) {
                                return;
                            }
                            GM_config.save();
                            break;
                        }
                        case 27 : {// [Esc]
                            GM_config.close();
                            break;
                        }
                        default : {
                            return;
                        }
                    }
                    event.stopPropagation();
                    event.preventDefault();
                } );
                
                frame_doc.querySelector( `#${config_id}_wrapper` ).addEventListener( 'change', event => {
                    update_save_status();
                }, false );
            },
            
            reset : function () {
                GM_config.set( 'DISPLAY_ALL_IN_ONE_PAGE', GM_config.get( 'DEFAULT_ACTION_ON_CLICK_EVENT', true ) == messages.DISPLAY_ALL_IN_ONE_PAGE_DESCRIPTION );
                update_save_status();
            },
            
            save : function ( forgotton ) {
                saved_value_map = get_config_value_map();
                update_save_status();
            },
            
            close : function () {
                var current_value_map = get_config_value_map();
                if ( 0 < get_diff_values( open_value_map, current_value_map ).length ) {
                    window.location.reload();
                }
            },
        },
        css : `
            #${config_id} {
                font-family: ${FONT_FAMILY};
                background-color: transparent;
            }
            
            #${config_id}_wrapper {
                width: 75%;
                min-width: 700px;
                margin: auto;
                background-color: #ffffff;
                padding: 16px 32px;
                border-radius: 8px;
                box-shadow: 3px 3px 6px;
            }
            
            #${config_id} .config_header {
                position: relative;
                font-size: 16px;
                margin: 0 auto;
                padding: 4px 8px;
                background-color: #4682b4;
                text-align: left;
            }
            
            #${config_id} .config_header a {
                display: inline-block;
                color: #fefefe;
                text-decoration: none;
            }
            
            #${config_id} .section_header {
                margin: 12px 0 6px;
                padding-left: 4px;
                font-size: 14px;
                color: #4682b4;
                background-color: transparent;
                text-align: left;
                border: none;
                border-bottom: solid 2px #add8e6;
            }
            
            #${config_id}_header-title-link {
            }
            
            #${config_id}_header-donation-link {
                position: absolute;
                inset: auto 8px 4px auto ;
                font-size: 12px;
            }
            
            #${config_id} button,
            #${config_id} input[type="button"],
            #${config_id} input[type="submit"] {
                cursor: pointer;
            }
            
            #${config_id} .warning {
                font-weight: bolder;
                color: #ee0000;
            }
            
            #${config_id}_saveBtn {
            }
            
            #${config_id}_save-status {
                display: inline-block;
                vertical-align: middle;
            }
            
            #${config_id} .config_var {
                padding-left: 4px;
                border-bottom: dotted 1px #add8e6;
            }
            
            #${config_id} .field_label {
                display: inline-block;
                min-width: 50%;
            }
            
            #${config_id} .config_var > div[id] {
                display: inline-block;
            }
            
            #${config_id}_DISPLAY_ALL_IN_ONE_PAGE_var {
                display: none;
            }
        `,
    } );
    
    GM_registerMenuCommand( messages.SETTINGS, () => GM_config.open() );
    
    Object.assign( user_options, get_config_value_map() );
    
    return user_options;
} // end of init_gm_menu()

if ( is_extension() ) {
    // Google Chorme 拡張機能から実行した場合、ユーザーオプションを読み込む
    w.twOpenOriginalImage_chrome_init( function ( user_options ) {
        initialize( user_options );
    } );
}
else if ( typeof GM_config != 'undefined' ) {
    init_gm_menu().then( user_options => initialize( user_options ) );
}
else {
    initialize();
}

} )( window, document );

// ■ end of file
