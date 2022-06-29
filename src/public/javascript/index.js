$.ajaxSetup({
    headers: {
        "csrf-token": $("meta[name=\"csrf-token\"]").attr("content")
    }
});

$(document).on("click", "a[data-method]", function(e){
    e.preventDefault();
    const link = $(this);
    if(link.attr("data-confirm") && !confirm(link.attr("data-confirm")))
        return;
    $.ajax({
        type: link.attr("data-method"),
        url: link.attr("href"),
        success: (res, status) => {
            if(status === "success")
                window.location.href = res.redirectUri;
            else if(status === "nocontent")
                window.location.reload();
        },
        error: (res, status) => {
            window.location.reload();
        }
    });
});

$(document).ready(() => {
    setTimeout(() => $(".fade-out-5").fadeOut(1000, "swing", function(){ $(this).remove() }), 4000);

    $("form[data-method]").submit(function(e){
        e.preventDefault();
        const required = $("input[data-required]");
        for(const input of required)
            if(!$(input).val())
                return;
        const form = $(this);
        const urlencoded = form.attr("enctype") === undefined || form.attr("enctype") !== "multipart/form-data";
        let sendData = form.serialize();
        const ajaxOptions = {
            type: form.attr("data-method"),
            url: form.attr("action"),
            success: (res, status) => {
                if(status === "success")
                    window.location.href = res.redirectUri;
                else if(status === "nocontent")
                    window.location = window.location.href;
            },
            error: (res, status) => {
                window.location = window.location.href;
            }
        };
        if(!urlencoded){
            sendData = new FormData(form[0]);
            Object.assign(ajaxOptions, { processData: false, contentType: false });
        }
        Object.assign(ajaxOptions, { data: sendData });
        $.ajax(ajaxOptions);
    });
});

function checkForm(){
    if($(".error-message").length)
        $(".error-message").empty();
    else
        $("button[type=\"submit\"]").before("<ul class=\"error-message\"></ul>");
    const required = $("input[data-required]");
    let success = true;
    for(const input of required)
        if(!$(input).val()){
            $(".error-message").append(`<li><font color="red">${$(input).attr("data-required")}</font></li>`);
            success = false;
        }
    return success;
}
