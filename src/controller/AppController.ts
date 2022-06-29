import * as showdown from "showdown";
import * as xssFilter from "showdown-xss-filter";

export abstract class AppController{

    protected readonly converter = new showdown.Converter({ extensions: [xssFilter] });

    constructor(){
        this.converter.setOption("parseImgDimensions", true);
        this.converter.setOption("simplifiedAutoLink", true);
        this.converter.setOption("excludeTrailingPunctuationFromURLs", true);
        this.converter.setOption("strikethrough", true);
        this.converter.setOption("tables", true);
        // The bug of showdown is not fixed
        // this.converter.setOption("tasklists", true);
        this.converter.setOption("simpleLineBreaks", true);
        this.converter.setOption("requireSpaceBeforeHeadingText", true);
        this.converter.setOption("emoji", true);
    }
}
