( () => {
'use strict';

window.xhr_monitor.add_monitor(
    'twOpenOriginalImage.tweet-capture',
    /\/i\/api\/graphql\//, //twitter (absolute or relative URL)
    ['GET', 'POST',]
);

} )();
