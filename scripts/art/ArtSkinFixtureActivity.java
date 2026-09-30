package com.danteb.arrows;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.View;
import com.danteb.arrows.board.CinnamonSkin;

/** Copied into the ignored Android project for captures only. No gameplay or persistence. */
public final class ArtSkinFixtureActivity extends Activity {
  private CinnamonSkin skin;
  private final float cell = 38f;
  // Cell-centre routes: straights in four directions and clockwise/counterclockwise bends.
  private final int[][] routes = {
    {0,0,3,0}, {8,0,5,0}, {0,2,0,4}, {2,4,2,2},
    {4,2,6,2,6,4}, {8,4,8,2,7,2},
    {0,6,2,6,2,5}, {4,5,4,6,3,6},
    {6,5,6,6,8,6}, {8,8,6,8,6,7},
    {0,8,2,8,2,10}, {4,10,4,8,3,8}, {6,10,8,10},
    {0,10,1,10}
  };
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    if (getIntent().getBooleanExtra("artSkinTextured", false)) skin = CinnamonSkin.Companion.load(this);
    setContentView(new View(this) {
      final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
      @Override protected void onDraw(Canvas canvas) {
        canvas.drawColor(Color.rgb(255,248,239));
        float density = getResources().getDisplayMetrics().density;
        canvas.save();
        canvas.scale(density, density);
        float width = getWidth()/density, height = getHeight()/density;
        paint.setColor(Color.rgb(89,56,40)); paint.setTextSize(18f); paint.setStyle(Paint.Style.FILL);
        canvas.drawText("Cinnamon Roll · 38 dp", 12f, 40f, paint);
        canvas.translate((width - 9*cell)/2, (height - 11*cell)/2);
        paint.setColor(Color.rgb(228,210,187)); paint.setStrokeWidth(2f);
        for(int r=0;r<11;r++) for(int c=0;c<9;c++) canvas.drawPoint((c+.5f)*cell,(r+.5f)*cell,paint);
        for(int[] route : routes) {
          float[] points = new float[route.length];
          for(int i=0;i<route.length;i++) points[i]=(route[i]+.5f)*cell;
          if(skin!=null) { skin.draw(canvas,points,points.length/2,cell,255); continue; }
          Path path=new Path(); path.moveTo(points[0],points[1]);
          for(int i=2;i<points.length;i+=2) path.lineTo(points[i],points[i+1]);
          paint.setColor(Color.rgb(89,56,40)); paint.setStyle(Paint.Style.STROKE);
          paint.setStrokeWidth(cell*.144f); paint.setStrokeJoin(Paint.Join.ROUND); paint.setStrokeCap(Paint.Cap.ROUND);
          canvas.drawPath(path,paint);
          int end=points.length-2; float dx=points[end]-points[end-2],dy=points[end+1]-points[end-1];
          float len=(float)Math.hypot(dx,dy); dx/=len; dy/=len;
          float x=points[end],y=points[end+1];
          Path head=new Path(); head.moveTo(x+dx*cell*.5f,y+dy*cell*.5f);
          head.lineTo(x-dy*cell*.27f,y+dx*cell*.27f); head.lineTo(x+dy*cell*.27f,y-dx*cell*.27f); head.close();
          paint.setStyle(Paint.Style.FILL); canvas.drawPath(head,paint);
        }
        canvas.restore();
      }
    });
  }
  @Override public void onDestroy() { if(skin!=null) skin.release(); super.onDestroy(); }
}
