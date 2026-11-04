import { Component, lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound, MapPin, LoaderCircle } from 'lucide-react';
import { ROLE, notifyError, notifySuccess } from '../utils/helpers';
import './login.css';

const LoginBuilding=lazy(()=>import('../components/LoginBuilding'));
const base=import.meta.env.BASE_URL;
const previewOnly = import.meta.env.VITE_PREVIEW_ONLY === 'true';
class LoginBackdropBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?null:this.props.children;}
}

export function Login({ auth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [visible,setVisible]=useState(false);
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    if(auth.loading || previewOnly)return;
    setError('');
    const result = await auth.login(username, password);
    if (!result.ok) {
      notifyError({ message: result.message }, result.message);
      return setError(result.message);
    }
    notifySuccess('Login berjaya');
    navigate(result.role === ROLE.guard ? '/pengawal' : '/dashboard');
  };

  return (
    <main className="penjaga-login">
      <div className="login-landscape" aria-hidden="true"><img className="login-building-preview" src={`${base}models/library/previews/djm.webp`} alt=""/><LoginBackdropBoundary><Suspense fallback={null}><LoginBuilding/></Suspense></LoginBackdropBoundary></div>
      <header className="login-masthead"><div className="login-wordmark"><img src={`${base}favicon.svg`} width="48" height="48" alt=""/><div><strong>PENJAGA</strong><span>OPERASI KESELAMATAN</span></div></div><span className="login-edition">PORTAL PETUGAS</span></header>
      <div className="login-layout">
        <section className="login-story" aria-label="PENJAGA, pengurusan operasi keselamatan"><p className="login-kicker"><span/>KESELAMATAN BERMULA DENGAN KESIAPSIAGAAN</p><h2>Kenali kawasan.<br/><em>Kawal operasi.</em></h2><p className="login-story-copy">Jadual, laporan dan tindakan.<br/>Terhubung dalam satu ruang kerja.</p><div className="login-location"><MapPin size={16}/><div><strong>Bangunan Dato’ Jaafar Muhammad</strong><span>Kota Iskandar, Johor · Model eksterior 3D</span></div></div></section>
        <section className="login-panel" aria-labelledby="login-title"><div className="login-panel-top"><span className="login-panel-line"/><span>AKSES PETUGAS</span><LockKeyhole size={15}/></div><h1 id="login-title">Selamat kembali.</h1><p className="login-intro">Log masuk ke ruang operasi anda.</p>
          {previewOnly ? <p className="login-error">Pratonton hos. Log masuk belum tersedia.</p> : <form onSubmit={submit} aria-busy={auth.loading}>
            <label htmlFor="login-username">Nama pengguna</label><div className="login-input-wrap"><UserRound size={18}/><input id="login-username" name="username" value={username} onChange={e=>setUsername(e.target.value)} required autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={auth.loading} placeholder="Masukkan nama pengguna" aria-describedby={error?'login-error':undefined}/></div>
            <label htmlFor="login-password">Kata laluan</label><div className="login-input-wrap"><LockKeyhole size={18}/><input id="login-password" name="password" type={visible?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" disabled={auth.loading} placeholder="Masukkan kata laluan" aria-describedby={error?'login-error':undefined}/><button type="button" className="login-password-toggle" aria-label={visible?'Sembunyikan kata laluan':'Tunjuk kata laluan'} aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
            {error&&<p id="login-error" className="login-error" role="alert">{error}</p>}
            <button className="login-submit" type="submit" disabled={auth.loading}><span>{auth.loading?'Sedang log masuk…':'Log Masuk'}</span>{auth.loading?<LoaderCircle size={19} className="login-spinner"/>:<ArrowRight size={19}/>}</button>
          </form>}{!previewOnly && <div className="login-assistance"><span>Perlukan bantuan akses?</span><p>Hubungi pentadbir sistem anda.</p></div>}
        </section>
      </div>
      <footer className="login-footer"><span>Sistem Pengurusan Operasi Keselamatan</span><span>PENJAGA<span className="login-footer-dot"> / </span>JOHOR</span></footer>
    </main>
  );
}
