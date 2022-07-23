define("ace/theme/material_dark",["require","exports","module","ace/lib/dom"],function(e,t,n){t.isDark=!0,t.cssClass="ace-material_dark",t.cssText=`
.ace-material_dark .ace_gutter {
    background: #212121;
    color: #545454
}
.ace-material_dark .ace_print-margin {
    width: 1px;
    background: #212121
}
.ace-material_dark {
    background-color: #212121;
    color: #EEFFFF
}
.ace-material_dark .ace_cursor {
    color: #FFCC00
}
.ace-material_dark .ace_marker-layer .ace_selection {
    background: rgba(128, 203, 196, 0.2);
}
.ace-material_dark.ace_multiselect .ace_selection.ace_start {
    box-shadow: 0 0 3px 0px #272822;
}
.ace-material_dark .ace_marker-layer .ace_step {
background: rgb(102.ace-material_dark,82.ace-material_dark,0)
}
.ace-material_dark .ace_marker-layer .ace_bracket {
margin: -1px 0 0 -1px;
border: 1px solid #49483E
}
.ace-material_dark .ace_marker-layer .ace_active-line {
background: #202020
}
.ace-material_dark .ace_gutter-active-line {
background-color: #272727
}
.ace-material_dark .ace_marker-layer .ace_selected-word {
border: 1px solid #49483E
}
.ace-material_dark .ace_invisible {
color: #52524d
}
.ace-material_dark .ace_entity.ace_name.ace_tag.ace-material_dark,
.ace-material_dark .ace_keyword.ace-material_dark,
.ace-material_dark .ace_meta.ace_tag.ace-material_dark,
.ace-material_dark .ace_storage {
color: #F92672
}
.ace-material_dark .ace_punctuation.ace-material_dark,
.ace-material_dark .ace_punctuation.ace_tag {
color: #fff
}
.ace-material_dark .ace_constant.ace_character.ace-material_dark,
.ace-material_dark .ace_constant.ace_language.ace-material_dark,
.ace-material_dark .ace_constant.ace_numeric.ace-material_dark,
.ace-material_dark .ace_constant.ace_other {
color: #AE81FF
}
.ace-material_dark .ace_invalid {
color: #F8F8F0;
background-color: #F92672
}
.ace-material_dark .ace_invalid.ace_deprecated {
color: #F8F8F0;
background-color: #AE81FF
}
.ace-material_dark .ace_support.ace_constant.ace-material_dark,
.ace-material_dark .ace_support.ace_function {
color: #F92672
}
.ace-material_dark .ace_fold {
background-color: #A6E22E;
border-color: #F8F8F2
}
.ace-material_dark .ace_storage.ace_type.ace-material_dark,
.ace-material_dark .ace_support.ace_class.ace-material_dark,
.ace-material_dark .ace_support.ace_type {
font-style: italic;
color: #66D9EF
}
.ace-material_dark .ace_entity.ace_name.ace_function.ace-material_dark,
.ace-material_dark .ace_entity.ace_other.ace-material_dark,
.ace-material_dark .ace_entity.ace_other.ace_attribute-name.ace-material_dark,
.ace-material_dark .ace_variable {
color: #A6E22E
}
.ace-material_dark .ace_variable.ace_parameter {
font-style: italic;
color: #FD971F
}
.ace-material_dark .ace_string {
color: #C3E88D
}
.ace-material_dark .ace_comment {
color: #545454
}
.ace-material_dark .ace_indent-guide {
background: url(data:image/png;base64.ace-material_dark,
iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQImWPQ0FD0ZXBzd/wPAAjVAoxeSgNeAAAAAElFTkSuQmCC) right repeat-y
}

`;var r=e("../lib/dom");r.importCssString(t.cssText,t.cssClass)});                (function() {
                    window.require(["ace/theme/material_dark"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            