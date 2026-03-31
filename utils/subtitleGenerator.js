export function generateSRT(subtitles) {
    let srt = '';
    subtitles.forEach((sub, index) => {
        srt += `${index + 1}\n`;
        srt += `${formatTime(sub.start)} --> ${formatTime(sub.end)}\n`;
        srt += `${sub.text}\n\n`;
    });
    return srt;
}

export function generateVTT(subtitles) {
    let vtt = 'WEBVTT\n\n';
    subtitles.forEach((sub) => {
        vtt += `${formatTime(sub.start, true)} --> ${formatTime(sub.end, true)}\n`;
        vtt += `${sub.text}\n\n`;
    });
    return vtt;
}

function formatTime(seconds, isVTT = false) {
    const date = new Date(0);
    date.setSeconds(seconds);
    date.setMilliseconds((seconds % 1) * 1000);
    const timeString = date.toISOString().substr(11, 12);

    if (isVTT) {
        // VTT format: HH:MM:SS.mmm
        return timeString;
    } else {
        // SRT format: HH:MM:SS,mmm
        return timeString.replace('.', ',');
    }
}
