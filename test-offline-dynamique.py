#!/usr/bin/env python3
import http.server, json, socketserver, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

PORT=8765
HARNESS=Path('.quality-offline.html')
REPORT=Path('rapports/offline-dynamic.json')
HARNESS.write_text('<!doctype html><script src="hors-ligne.js"></script>',encoding='utf-8')

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
class Server(socketserver.TCPServer): allow_reuse_address=True
srv=Server(('127.0.0.1',PORT),Handler); threading.Thread(target=srv.serve_forever,daemon=True).start()
checks=[]
def ck(nom,ok,detail=None):
    checks.append({'nom':nom,'ok':bool(ok),'detail':detail})
    if not ok: raise AssertionError(f'{nom}: {detail}')

try:
  with sync_playwright() as p:
    b=p.chromium.launch(headless=True); c=b.new_context(service_workers='block')
    c.add_init_script("""
      window.__u={id:'user-a',ecole_id:'ecole-a'};
      window.ArdoiseSession={utilisateur:()=>window.__u};
      window.__sent=[];
      window.appelApi=async (chemin,options)=>{window.__sent.push({chemin,methode:(options&&options.method)||'GET'});return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}})};
    """)
    page=c.new_page(); page.goto(f'http://127.0.0.1:{PORT}/{HARNESS.name}')
    page.wait_for_function('window.ArdoiseHorsLigne')
    c.set_offline(True); page.wait_for_timeout(150)
    a=page.evaluate("""async()=>{const r=await appelApi('/notes/grille',{method:'POST',body:'{}'});return {s:r.status,b:await r.json(),q:ArdoiseHorsLigne.enAttente()}}""")
    ck('note différée',a['s']==202 and a['b'].get('differee') is True,a); ck('file=1',a['q']==1,a)
    x=page.evaluate("""async()=>{const r=await appelApi('/paiements',{method:'POST',body:'{}'});return {s:r.status,b:await r.json(),q:ArdoiseHorsLigne.enAttente()}}""")
    ck('paiement refusé',x['s']==503 and x['b'].get('differee') is False,x); ck('paiement non mis en file',x['q']==1,x)
    page.evaluate("window.__u={id:'user-b',ecole_id:'ecole-b'}"); c.set_offline(False); page.wait_for_timeout(250)
    y=page.evaluate("""async()=>{await ArdoiseHorsLigne.synchroniser();return {q:ArdoiseHorsLigne.enAttente(),s:window.__sent.slice()}}""")
    ck('pas de replay inter-écoles',y['q']==1 and len(y['s'])==0,y)
    page.evaluate("window.__u={id:'user-a',ecole_id:'ecole-a'}")
    z=page.evaluate("""async()=>{await ArdoiseHorsLigne.synchroniser();return {q:ArdoiseHorsLigne.enAttente(),s:window.__sent.slice()}}""")
    ck('replay propriétaire unique',z['q']==0 and len(z['s'])==1 and z['s'][0]['chemin']=='/notes/grille',z)
    z2=page.evaluate("""async()=>{await ArdoiseHorsLigne.synchroniser();return {q:ArdoiseHorsLigne.enAttente(),n:window.__sent.length}}""")
    ck('aucun doublon',z2['q']==0 and z2['n']==1,z2); b.close()
  status='reussi'
except Exception as e:
  status='echec'; checks.append({'nom':'exception','ok':False,'detail':str(e)[:800]})
finally:
  srv.shutdown(); srv.server_close(); HARNESS.unlink(missing_ok=True)
REPORT.parent.mkdir(exist_ok=True)
REPORT.write_text(json.dumps({'suite':'offline','statut':status,'total':len(checks),'reussis':sum(1 for x in checks if x['ok']),'echoues':sum(1 for x in checks if not x['ok']),'ignores':0,'checks':checks},ensure_ascii=False,indent=2),encoding='utf-8')
for x in checks: print(('OK ' if x['ok'] else 'KO ')+x['nom'])
raise SystemExit(0 if status=='reussi' else 1)
