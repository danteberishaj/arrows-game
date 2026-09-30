package com.danteb.arrows;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Color;
import android.widget.FrameLayout;
import android.widget.TextView;
import java.lang.ref.WeakReference;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import com.facebook.react.bridge.ReactApplicationContext;
import expo.modules.core.ModuleRegistry;
import expo.modules.kotlin.AppContext;
import expo.modules.kotlin.ModulesProvider;
import expo.modules.kotlin.modules.Module;
import expo.modules.kotlin.services.Service;
import com.danteb.arrows.board.ArrowsBoardView;

/** Diagnostic-only host of the actual retained view. Copy/register only in a capture APK. */
public final class ProceduralSkinFixtureActivity extends androidx.appcompat.app.AppCompatActivity {
  private ArrowsBoardView board;
  private ReactApplicationContext react;
  private float cell;
  private int count;
  private boolean reduced;
  private final Handler clock = new Handler(Looper.getMainLooper());
  private final int[][] routes = {
    {0,0,3,0},{8,0,5,0},{0,2,0,4},{2,4,2,2},
    {4,2,6,2,6,4},{8,4,8,2,7,2},{0,6,2,6,2,5},
    {4,5,4,6,3,6},{6,5,6,6,8,6},{8,8,6,8,6,7},
    {0,8,2,8,2,10},{4,10,4,8,3,8},{6,10,8,10},{0,10,1,10}
  };
  private String feedback = "-1,-1,-1,-1,-1,-1,-1";
  private char[] mask;
  private long id = 1;
  private void prop(String name, Object value) {
    switch(name) {
      case "setArtSkin": board.setArtSkin$arrows_board_release((String)value); break;
      case "setSkinFeedback": board.setSkinFeedback$arrows_board_release((String)value); break;
      case "setGeometry": board.setGeometry$arrows_board_release((String)value); break;
      case "setVisibleMask": board.setVisibleMask$arrows_board_release((String)value); break;
      case "setMarkMask": board.setMarkMask$arrows_board_release((String)value); break;
      case "setMarkColor": board.setMarkColor$arrows_board_release((String)value); break;
      case "setInk": board.setInk$arrows_board_release((String)value); break;
      case "setStrokeWidth": board.setStrokeWidth$arrows_board_release((Float)value); break;
      case "setExitAnimation": board.setExitAnimation$arrows_board_release((String)value); break;
      default: throw new IllegalArgumentException(name);
    }
  }
  private void commit() { board.commitProps$arrows_board_release(); }
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    cell=getIntent().getFloatExtra("cell",38f); count=getIntent().getIntExtra("count",14);
    reduced=getIntent().getBooleanExtra("reduced",false);
    react=(ReactApplicationContext)((com.facebook.react.ReactApplication)getApplication()).getReactHost().getCurrentReactContext();
    if(react==null) throw new IllegalStateException("Launch MainActivity before the native fixture");
    react.onHostResume(this);
    ModulesProvider provider=new ModulesProvider(){
      public Map<Class<? extends Module>,String> getModulesMap(){return Collections.emptyMap();}
      public List<Class<? extends Service>> getServices(){return Collections.emptyList();}
    };
    AppContext appContext=new AppContext(provider,new ModuleRegistry(Collections.emptyList(),Collections.emptyList()),new WeakReference<>(react));
    FrameLayout frame=new FrameLayout(this);frame.setBackgroundColor(Color.rgb(255,248,239));
    float density=getResources().getDisplayMetrics().density;
    board=new ArrowsBoardView(this,appContext);
    FrameLayout.LayoutParams layout=new FrameLayout.LayoutParams(Math.round(9*cell*density),Math.round(11*cell*density));
    layout.gravity=android.view.Gravity.CENTER; frame.addView(board,layout);
    TextView title=new TextView(this);title.setText("Cinnamon Roll · " + cell + " dp" + (reduced?" · reduced motion":""));
    title.setTextColor(Color.rgb(89,56,40));title.setTextSize(18f);title.setPadding(36,60,0,0);frame.addView(title);
    setContentView(frame);
    StringBuilder geometry=new StringBuilder();
    for(int i=0;i<count;i++){if(i>0)geometry.append(';');geometry.append(record(routes[i%routes.length]));}
    mask=new char[count];java.util.Arrays.fill(mask,'1');
    prop("setArtSkin","cinnamon,"+cell+","+(reduced?1:0)+",0");
    prop("setGeometry",geometry.toString());prop("setVisibleMask",new String(mask));
    prop("setInk","#593828");prop("setStrokeWidth",cell*.144f);
    if(getIntent().getBooleanExtra("marks",false)) {
      char[] marks=new char[count];for(int i=0;i<count;i++)marks[i]=i%2==0?'1':'0';
      prop("setMarkMask",new String(marks));prop("setMarkColor","#C97883");
    }
    commit();
    if(getIntent().getBooleanExtra("replay",false)) {
      schedule(1000,()->feed("0,-1,-1,-1,-1,-1,-1","press-down"));
      schedule(1800,()->feed("-1,-1,-1,-1,-1,-1,-1","press-release"));
      for(int i=1;i<=5;i++){final int arrow=i;schedule(3000+(i-1)*180,()->exit(arrow));}
      schedule(5500,()->feed("-1,50,6,50,7,-1,-1","blocked"));
      schedule(5840,()->feed("-1,-1,-1,-1,-1,-1,-1","blocked-end"));
      schedule(7000,()->feed("-1,-1,-1,-1,-1,60,8","hint"));
    }
  }
  private void schedule(long delay,Runnable task){clock.postDelayed(task,delay);}
  private void feed(String value,String event){
    android.util.Log.i("ArtSkinMotion",event+" uptimeMs="+android.os.SystemClock.uptimeMillis()+" reduced="+reduced);
    feedback=value;prop("setSkinFeedback",feedback);commit();
  }
  private String record(int[] route){
    StringBuilder s=new StringBuilder().append(route.length/2);
    for(int i=0;i<route.length;i+=2)s.append(',').append((route[i]+.5f)*cell).append(',').append((route[i+1]+.5f)*cell);
    int e=route.length-2;float dx=route[e]-route[e-2],dy=route[e+1]-route[e-1];float length=(float)Math.hypot(dx,dy);dx/=length;dy/=length;
    float x=(route[e]+.5f)*cell,y=(route[e+1]+.5f)*cell;
    s.append(',').append(x+dx*cell*.5f).append(',').append(y+dy*cell*.5f);
    s.append(',').append(x-dy*cell*.27f).append(',').append(y+dx*cell*.27f);
    s.append(',').append(x+dy*cell*.27f).append(',').append(y-dx*cell*.27f);
    return s.toString();
  }
  private void exit(int index){
    int[] route=routes[index%routes.length];int e=route.length-2;
    float dx=route[e]-route[e-2],dy=route[e+1]-route[e-1],len=(float)Math.hypot(dx,dy);dx/=len;dy/=len;
    float body=0;for(int i=2;i<route.length;i+=2)body+=Math.hypot(route[i]-route[i-2],route[i+1]-route[i-1])*cell;
    float ray=12*cell;StringBuilder s=new StringBuilder();
    s.append(id++).append(',').append(index).append(",650,").append(reduced?1:0).append(',').append(cell*.144f)
      .append(',').append(body).append(',').append(body+ray).append(',').append(dx).append(',').append(dy).append(',').append(route.length/2+1);
    for(int i=0;i<route.length;i+=2)s.append(',').append((route[i]+.5f)*cell).append(',').append((route[i+1]+.5f)*cell);
    s.append(',').append((route[e]+.5f)*cell+dx*ray).append(',').append((route[e+1]+.5f)*cell+dy*ray);
    android.util.Log.i("ArtSkinMotion","exit-"+index+" uptimeMs="+android.os.SystemClock.uptimeMillis()+" reduced="+reduced);
    mask[index]='0';prop("setVisibleMask",new String(mask));prop("setExitAnimation",s.toString());commit();
  }
  @Override public void onDestroy(){clock.removeCallbacksAndMessages(null);if(react!=null)react.onHostPause();super.onDestroy();}
}
