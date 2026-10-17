import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewCurrentLocation} from './current-location.ts';
test('preview accepts zero coordinates and cancellation rejects a late result',async()=>{
  const controller=new AbortController(); let success;
  const pending=previewCurrentLocation(controller.signal,{getCurrentPosition(callback){success=callback;}});
  controller.abort();
  await assert.rejects(pending,error=>error.name==='AbortError');
  success({coords:{latitude:1,longitude:1}});
  const result=await previewCurrentLocation(new AbortController().signal,{
    getCurrentPosition(callback){callback({coords:{latitude:0,longitude:0}});}
  });
  assert.equal(result.lat,0); assert.equal(result.source,'current');
});
test('permission denial explains manual selection and invalid positions are rejected',async()=>{
  await assert.rejects(previewCurrentLocation(new AbortController().signal,{
    getCurrentPosition(success,error){error({code:1});}
  }),/enter an address/);
  await assert.rejects(previewCurrentLocation(new AbortController().signal,{
    getCurrentPosition(success){success({coords:{latitude:100,longitude:0}});}
  }),/valid location/);
});
test('a slow first lookup recovers using a longer fresh position attempt',async()=>{
  let attempts=0;
  const result=await previewCurrentLocation(new AbortController().signal,{
    getCurrentPosition(success,error,options){
      attempts++;
      if(attempts===1) { error({code:3}); return; }
      assert.ok(options.timeout>10000);
      assert.equal(options.maximumAge,0);
      assert.equal(options.enableHighAccuracy,true);
      success({coords:{latitude:9.08,longitude:7.4}});
    }
  });
  assert.equal(result.lat,9.08);
  assert.equal(attempts,2);
});
test('repeated timeouts stop after two attempts with actionable advice',async()=>{
  let attempts=0;
  await assert.rejects(previewCurrentLocation(new AbortController().signal,{
    getCurrentPosition(success,error){attempts++; error({code:3});}
  }),/device.*location|location.*device/i);
  assert.equal(attempts,2);
});
test('cancelled timeout callbacks cannot trigger another lookup',async()=>{
  let failure; let attempts=0;
  const controller=new AbortController();
  const pending=previewCurrentLocation(controller.signal,{
    getCurrentPosition(success,error){attempts++; failure=error;}
  });
  controller.abort(); await assert.rejects(pending,{name:'AbortError'});
  failure({code:3}); assert.equal(attempts,1);
});
test('permission denial does not retry or ask for a fresh position',async()=>{
  let attempts=0;
  await assert.rejects(previewCurrentLocation(new AbortController().signal,{
    getCurrentPosition(success,error){attempts++; error({code:1});}
  }),/blocked/);
  assert.equal(attempts,1);
});
test('late first-attempt coordinates cannot override the fresh attempt',async()=>{
  const calls=[];
  const pending=previewCurrentLocation(new AbortController().signal,{
    getCurrentPosition(success,error){calls.push({success,error});}
  });
  calls[0].error({code:3});
  calls[0].success({coords:{latitude:1,longitude:1}});
  calls[1].success({coords:{latitude:9,longitude:7}});
  const result=await pending;
  assert.equal(result.lat,9);
});
