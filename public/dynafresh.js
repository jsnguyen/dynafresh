function timedRefresh(img) {
    // just change src attribute, will always trigger the onload callback
    img.src = img.src.split('?')[0] + '?d=' + Date.now()
}

function addFilename(arr) {
    var fs = document.getElementById('fileSelect')

    if (arr.some(el => Array.from(fs.options).includes(el)) ) {
        console.log('removing')
        removeOptions(fs)
    }

    arr.forEach( element => {
        var option = document.createElement('option')
        option.text = element 
        fs.add(option)
    })

    }

function removeOptions(selectElement) {
    var i, L = selectElement.options.length - 1;
    for(i = L; i >= 0; i--) {
        selectElement.remove(i);
    }
}

// parameters
const port = 12301

function main(){

    window.onload = () => {

        var img = new Image()

        img.onload = function() {
            var canvas = document.getElementById('canvas')
            var context = canvas.getContext('2d')
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
            context.drawImage(img, (canvas.width-img.width)/2, (canvas.height-img.height)/2)
        }

        var fs = document.getElementById('fileSelect')
        fs.onchange = () => {
            img.src = 'images/'+fs.options[fs.selectedIndex].text
        }

        var leftArrow = document.getElementById('leftArrow')
        leftArrow.onclick = () => {
            if (fs.selectedIndex == 0) {
                var new_index = fs.options.length-1
            } else {
                var new_index = fs.selectedIndex-1
            }
            img.src = 'images/'+fs.options[new_index].text
            fs.selectedIndex = new_index
        }

        var rightArrow = document.getElementById('rightArrow')
        rightArrow.onclick = () => {
            if (fs.selectedIndex == fs.options.length-1) {
                var new_index = 0
            } else {
                var new_index = fs.selectedIndex+1
            }
            img.src = 'images/'+fs.options[new_index].text
            fs.selectedIndex = new_index
        }

        const socket = new WebSocket('ws://localhost:'+String(port+1))

        socket.addEventListener('message', function (event) {
            console.log('Message from server ', event.data);
            var json_obj = JSON.parse(event.data)
            addFilename(json_obj)

            if (img.src === '') {
                img.src = 'images/'+fs.options[0].text
            } else {
                img.src = img.src.split('?')[0] + '?d=' + Date.now()
            }

        });


    }

}

main()
