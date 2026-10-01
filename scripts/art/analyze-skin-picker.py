#!/usr/bin/env python3
"""Match recorded pixels to JS tap epoch using Android's legacy Winscope frame metadata."""
import pathlib, json, struct, subprocess, statistics, hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]; OUT=ROOT/'artifacts/ART-SKINS-06'
data=json.loads((OUT/'perf/switch-raw.json').read_text()); assert len(data['runs'])==18
for run in data['runs']:
    path=OUT/'perf'/run['video'];content=path.read_bytes();magic=b'#VV1NSC0PET1ME!#';offset=content.find(magic);assert offset>=0
    count=struct.unpack_from('<I',content,offset+len(magic))[0]
    elapsedUs=struct.unpack_from('<'+str(count)+'Q',content,offset+len(magic)+4)
    assert all(b>=a for a,b in zip(elapsedUs,elapsedUs[1:]))
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=pts_time','-of','json',str(path)],text=True))
    pts=[float(f['pts_time']) for f in probe['frames']];assert len(pts)==count
    assert max(abs((t-elapsedUs[0])/1e6-p) for t,p in zip(elapsedUs,pts))<.0001
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-map','0:v:0','-vf','scale=180:390:flags=area','-fps_mode','passthrough','-pix_fmt','rgb24','-f','rawvideo','pipe:1'])
    frameBytes=180*390*3;assert len(raw)==count*frameBytes
    counts=[]
    # Blank above the modal/wordmark, below the menu header. A board fills this known screen band.
    for i in range(count):
        frame=raw[i*frameBytes:(i+1)*frameBytes];dark=0
        for y in range(48,116):
            for x in range(180):
                j=(y*180+x)*3
                rgb=frame[j:j+3]
                # Reject the pale neutral grid / transition background: require recognizable arrow ink.
                if (sum(rgb)<400 if run['target']=='classic' else sum(rgb)<660 and max(rgb)-min(rgb)>15): dark+=1
        counts.append(dark)
    candidates=[i for i,n in enumerate(counts) if n>=50];assert candidates
    first=candidates[0]; assert first>0 and counts[-1]>500
    anchors=[run['startClock'],run['endClock']]
    offsets=[a['epochMs']*1000-(a['elapsedBeforeNs']+a['elapsedAfterNs'])/2000 for a in anchors]
    drift=abs(offsets[0]-offsets[1]);assert drift<3000, 'Clock offset changed; reject rather than guess'
    epochUs=elapsedUs[first]+statistics.mean(offsets)
    latencyMs=(epochUs-run['tapEpochMs']*1000)/1000;assert latencyMs>0
    gapMs=(elapsedUs[first]-elapsedUs[first-1])/1000
    run.update(firstVisibleFrameIndex=first,recordedFrameCount=count,firstVisiblePts=pts[first],
        firstVisibleElapsedUs=elapsedUs[first],tapToFirstRecordedBoardMs=latencyMs,
        precedingFrameGapMs=gapMs,clockDriftUs=drift,recordedPixelCounts=counts,
        videoSha256=hashlib.sha256(content).hexdigest())
    # Keep actual boundary frames so the pixel classifier can be reviewed independently.
    for label,index in [('previous',first-1),('first',first)]:
        subprocess.run(['ffmpeg','-y','-v','error','-i',str(path),'-vf',f'select=eq(n\\,{index})','-frames:v','1',str(OUT/'screens'/f'switch-{run["i"]:02d}-{label}.png')],check=True)
summary={'method':'tap release handler Date.now → first recorded frame with 50 recognizable arrow pixels; includes closing Settings and Play',
    'serial':data['serial'],'graphics':data['graphics'],'pixelBandAt180x390':[0,48,180,116],
    'threshold':'50 recognizable arrow pixels: Classic RGB sum <400; skins RGB sum <660 and channel spread >15','displayedCellDp':29.38775416782924,
    'metadataFormat':'Android legacy Winscope (#VV1NSC0PET1ME!#), elapsed realtime microseconds',
    'source':'https://android.googlesource.com/platform/frameworks/av/+/refs/heads/android11-mainline-extservices-release/cmds/screenrecord/screenrecord.cpp',
    'styles':{}}
for target in ['cinnamon','sherbet','classic']:
    runs=[r for r in data['runs'] if r['target']==target];assert len(runs)==6
    values=[r['tapToFirstRecordedBoardMs'] for r in runs]
    summary['styles'][target]={'n':len(runs),'screenCellDp':runs[0]['screenCellDp'],'medianMs':statistics.median(values),'maxMs':max(values),
        'recordedFrames':sum(r['recordedFrameCount'] for r in runs),'maxPrecedingFrameGapMs':max(r['precedingFrameGapMs'] for r in runs),
        'maxClockDriftUs':max(r['clockDriftUs'] for r in runs),'individualMs':values}
(OUT/'perf/switch-analyzed.json').write_text(json.dumps(data,indent=2)+'\n')
(OUT/'perf/switch-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
