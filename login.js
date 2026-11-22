(()=>{
  const form=document.getElementById('loginForm');
  const status=document.getElementById('authMessage');
  const config=window.WATAGACHI_SUPABASE_CONFIG;
  const nameInput=document.getElementById('displayName');
  const nameField=document.getElementById('displayNameField');
  const submitLabel=document.getElementById('submitLabel');
  const title=document.getElementById('formTitle');
  const intro=document.getElementById('formIntro');
  const note=document.getElementById('authNote');
  const password=document.getElementById('loginPassword');
  if(!window.supabase?.createClient){status.textContent='Sign-in service did not load. Refresh the page and try again.';return;}
  if(!config?.url||!config?.key){status.textContent='Supabase configuration is missing.';return;}
  const client=window.supabase.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let mode='signin';
  function setMode(next){
    mode=next==='signup'?'signup':'signin';form.dataset.mode=mode;
    document.querySelectorAll('[data-auth-mode]').forEach(tab=>{const active=tab.dataset.authMode===mode;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));tab.setAttribute('aria-pressed',String(active));});
    const creating=mode==='signup';nameField.hidden=!creating;nameInput.required=creating;password.autocomplete=creating?'new-password':'current-password';
    title.textContent=creating?'Create your employee account':'Sign in to continue';
    intro.textContent=creating?'Create an employee login with your name, email, and password.':'Sign in with your WATAGACHI employee account.';
    submitLabel.textContent=creating?'Create employee account':'Sign in';
    note.innerHTML=creating?'<b>Employee account:</b> Your login is saved in WATAGACHI and opens the employee workspace.':'<b>Employee access:</b> Sign in with your assigned employee account.';
    status.textContent='';
  }
  document.querySelectorAll('[data-auth-mode]').forEach(tab=>tab.addEventListener('click',()=>setMode(tab.dataset.authMode)));
  async function routeSession(session){
    if(!session?.user)return false;
    const {data:profile,error}=await client.from('profiles').select('role').eq('user_id',session.user.id).maybeSingle();
    if(error){status.textContent='Could not check your account type. Run the updated Supabase schema, then refresh.';return false;}
    if(profile?.role==='customer'){location.replace('customer.html');return false;}
    if(profile&&['staff','manager','admin'].includes(profile.role)){location.replace('app.html');return true;}
    await client.auth.signOut();status.textContent='This account is not assigned an employee role. Ask an administrator to assign employee access.';return false;
  }
  client.auth.getSession().then(({data,error})=>{if(error){status.textContent=error.message;return;}routeSession(data.session);});
  form.addEventListener('submit',async event=>{
    event.preventDefault();const f=new FormData(form),email=String(f.get('email')).trim(),pass=String(f.get('password'));
    const submit=form.querySelector('button[type=submit]');submit.disabled=true;status.textContent=mode==='signup'?'Creating employee account…':'Signing in…';
    try{
      if(mode==='signup'){
        const {data,error}=await client.auth.signUp({email,password:pass,options:{data:{display_name:String(f.get('displayName')).trim(),account_type:'employee'}}});
        if(error)throw error;
        if(!data.session){status.textContent='Supabase email confirmation is still enabled. Turn it off in Authentication settings, then create the account again.';return;}
        const {data:profile,error:profileError}=await client.from('profiles').select('role').eq('user_id',data.user.id).maybeSingle();
        if(profileError)throw profileError;
        if(!profile||!['staff','manager','admin'].includes(profile.role)){await client.auth.signOut();status.textContent='The account was created, but employee access was not assigned. Run the updated schema.sql, then ask an employee manager to assign the role.';return;}
        await routeSession(data.session);
      }else{
        const {data,error}=await client.auth.signInWithPassword({email,password:pass});if(error)throw error;await routeSession(data.session);if(!status.textContent)status.textContent='Signed in.';
      }
    }catch(error){status.textContent=error?.message||'Could not complete the request. Check your connection and account details.';}
    finally{submit.disabled=false;}
  });
  if(new URLSearchParams(location.search).has('access'))status.textContent='This account is not assigned an employee role. Use the customer pickup sign-in page or ask an administrator to assign employee access.';
})();
