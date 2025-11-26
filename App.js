import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, ImageBackground, SafeAreaView, ActivityIndicator, FlatList, Modal, Image } from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker'; 
import { supabase } from './supabase'; 

export default function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [view, setView] = useState('welcome'); // Views: welcome, auth, main
  const [activeTab, setActiveTab] = useState('home'); // Tabs: home, myapps, profile
  const [loading, setLoading] = useState(true);
  
  // Profile Data
  const [profile, setProfile] = useState({ full_name: '', phone: '', bio: '', experience_years: '' });
  
  // Auth Forms
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);

  // App Data
  const [jobs, setJobs] = useState([]);
  const [myApplications, setMyApplications] = useState([]); // List of job IDs I applied to
  const [applicants, setApplicants] = useState([]);
  
  // Farmer Post Job Inputs
  const [newJob, setNewJob] = useState({ title: '', location: '', pay: '', desc: '' });

  // Chat
  const [chatVisible, setChatVisible] = useState(false);
  const [activeAppId, setActiveAppId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => { checkUser(); }, []);

  // --- AUTH & SETUP ---
  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setSession(session);
      fetchProfile(session.user.id);
    } else {
      setLoading(false); setView('welcome');
    }
  };

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setUserRole(data.role);
      setProfile(data);
      if (data.role === 'worker' && !data.experience_years) {
        // First time setup? Let's just go to profile tab later.
      }
      setView('main');
      fetchData(data.role, userId);
    }
    setLoading(false);
  };

  const fetchData = async (role, userId) => {
    // 1. Fetch Jobs
    if (role === 'farmer') {
      const { data } = await supabase.from('jobs').select('*').eq('farmer_id', userId);
      setJobs(data || []);
    } else {
      const { data } = await supabase.from('jobs').select('*');
      setJobs(data || []);
      
      // 2. Fetch My Applications (To check what I already applied to)
      const { data: apps } = await supabase.from('applications').select('job_id, status').eq('worker_id', userId);
      if (apps) setMyApplications(apps);
    }
  };

  const handleAuth = async () => {
    setLoading(true);
    if (isLoginMode) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { Alert.alert("Error", error.message); setLoading(false); }
      else { setSession(data.session); fetchProfile(data.session.user.id); }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { Alert.alert("Error", error.message); setLoading(false); }
      else {
        await supabase.from('profiles').insert({ id: data.user.id, role: userRole, full_name: 'New User' });
        Alert.alert("Success", "Account created! Please Log in.");
        setIsLoginMode(true); setLoading(false);
      }
    }
  };

  // --- ACTIONS ---
  const applyForJob = async (jobId) => {
    const { error } = await supabase.from('applications').insert({ job_id: jobId, worker_id: session.user.id });
    if (error) {
      if(error.code === '23505') Alert.alert("Notice", "You have already applied.");
      else Alert.alert("Error", error.message);
    } else {
      Alert.alert("Success", "Application Sent!");
      fetchData('worker', session.user.id); // Refresh to update buttons
    }
  };

  const postJob = async () => {
    if (!newJob.title || !newJob.pay) return Alert.alert("Missing Info");
    await supabase.from('jobs').insert({ 
      title: newJob.title, location: newJob.location, pay_rate: newJob.pay, description: newJob.desc, farmer_id: session.user.id 
    });
    setNewJob({ title: '', location: '', pay: '', desc: '' });
    Alert.alert("Success", "Job Posted!");
    fetchData('farmer', session.user.id);
  };

  const updateProfile = async () => {
    setLoading(true);
    const { error } = await supabase.from('profiles').update({
      full_name: profile.full_name,
      phone: profile.phone,
      bio: profile.bio,
      experience_years: profile.experience_years
    }).eq('id', session.user.id);
    setLoading(false);
    if (error) Alert.alert("Error", error.message);
    else Alert.alert("Success", "Profile Updated!");
  };

  // --- HELPER TO CHECK IF APPLIED ---
  const getApplicationStatus = (jobId) => {
    const app = myApplications.find(a => a.job_id === jobId);
    return app ? app.status : null; // returns 'pending', 'accepted', or null
  };

  // --- RENDERERS ---

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2E5834" /></View>;

  // 1. WELCOME SCREEN
  if (view === 'welcome') return (
    <ImageBackground source={{uri: 'https://images.unsplash.com/photo-1625246333195-98d804e9b371?q=80'}} style={styles.bgImage}>
      <View style={styles.overlay}>
        <Text style={styles.titleBig}>AgriLink</Text>
        <Text style={{color:'#eee', marginBottom:30}}>Connect. Grow. Harvest.</Text>
        <View style={styles.glassCard}>
          <Text style={styles.labelWhite}>I am a...</Text>
          <TouchableOpacity style={styles.roleBtn} onPress={() => { setUserRole('farmer'); setView('auth'); }}>
            <Ionicons name="leaf" size={24} color="#2E5834" /><Text style={styles.roleText}>Farmer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.roleBtn} onPress={() => { setUserRole('worker'); setView('auth'); }}>
            <Ionicons name="hammer" size={24} color="#2E5834" /><Text style={styles.roleText}>Worker</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );

  // 2. AUTH SCREEN
  if (view === 'auth') return (
    <SafeAreaView style={styles.container}>
      <View style={styles.padding}>
        <TouchableOpacity onPress={() => setView('welcome')}><Ionicons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
        <Text style={styles.header}>{isLoginMode ? 'Welcome Back' : 'Create Account'}</Text>
        <Text style={styles.subHeader}>{userRole === 'farmer' ? 'Farmer Portal' : 'Worker Portal'}</Text>
        
        <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={styles.input} />
        <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
        
        <TouchableOpacity style={styles.btnMain} onPress={handleAuth}>
          <Text style={styles.btnText}>{isLoginMode ? 'Log In' : 'Sign Up'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)} style={{marginTop:20, alignSelf:'center'}}>
          <Text style={{color:'#2E5834'}}>{isLoginMode ? 'New here? Sign Up' : 'Have an account? Log In'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // 3. MAIN APP (TABS)
  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.topBar}>
        <Text style={styles.appLogo}>AgriLink</Text>
        <TouchableOpacity onPress={async () => { await supabase.auth.signOut(); setView('welcome'); }}>
          <Ionicons name="log-out-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={{flex:1}}>
        
        {/* TAB: HOME (Jobs) */}
        {activeTab === 'home' && (
          <ScrollView contentContainerStyle={styles.padding}>
            {userRole === 'farmer' && (
              <View style={styles.card}>
                <Text style={styles.cardHeader}>Post a Job</Text>
                <TextInput placeholder="Job Title" value={newJob.title} onChangeText={t=>setNewJob({...newJob, title:t})} style={styles.inputSmall} />
                <View style={{flexDirection:'row', gap:10}}>
                   <TextInput placeholder="Location" value={newJob.location} onChangeText={t=>setNewJob({...newJob, location:t})} style={[styles.inputSmall, {flex:1}]} />
                   <TextInput placeholder="Pay (RM)" value={newJob.pay} onChangeText={t=>setNewJob({...newJob, pay:t})} style={[styles.inputSmall, {flex:1}]} />
                </View>
                <TouchableOpacity style={styles.btnMain} onPress={postJob}><Text style={styles.btnText}>Post</Text></TouchableOpacity>
              </View>
            )}

            <Text style={styles.sectionTitle}>{userRole === 'farmer' ? 'My Listings' : 'Available Jobs'}</Text>
            {jobs.map(job => {
              const status = getApplicationStatus(job.id);
              return (
                <View key={job.id} style={styles.jobCard}>
                  <View>
                    <Text style={styles.jobTitle}>{job.title}</Text>
                    <Text style={styles.jobSub}>📍 {job.location}  •  💰 {job.pay_rate}</Text>
                  </View>
                  {userRole === 'worker' && (
                    <TouchableOpacity 
                      style={[styles.applyBtn, status && styles.disabledBtn]} 
                      disabled={!!status}
                      onPress={() => applyForJob(job.id)}>
                      <Text style={styles.applyBtnText}>{status ? status.toUpperCase() : 'Apply'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* TAB: PROFILE */}
        {activeTab === 'profile' && (
          <ScrollView contentContainerStyle={styles.padding}>
            <Text style={styles.sectionTitle}>Edit Profile</Text>
            
            <View style={styles.profileBox}>
              <View style={styles.avatarCircle}>
                <Text style={{fontSize:30}}>{userRole === 'farmer' ? '👨‍🌾' : '👷'}</Text>
              </View>
              
              <Text style={styles.label}>Full Name</Text>
              <TextInput value={profile.full_name} onChangeText={t=>setProfile({...profile, full_name:t})} style={styles.input} />
              
              <Text style={styles.label}>Phone Number</Text>
              <TextInput value={profile.phone} onChangeText={t=>setProfile({...profile, phone:t})} placeholder="+60..." style={styles.input} />
              
              <Text style={styles.label}>Bio / About Me</Text>
              <TextInput value={profile.bio} onChangeText={t=>setProfile({...profile, bio:t})} multiline style={[styles.input, {height:80}]} />
              
              {userRole === 'worker' && (
                <>
                  <Text style={styles.label}>Experience (Years)</Text>
                  <TextInput value={profile.experience_years} onChangeText={t=>setProfile({...profile, experience_years:t})} style={styles.input} />
                </>
              )}

              <TouchableOpacity style={styles.btnMain} onPress={updateProfile}>
                {loading ? <ActivityIndicator color="white"/> : <Text style={styles.btnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

      </View>

      {/* BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('home')}>
          <Ionicons name="briefcase" size={24} color={activeTab==='home'?'#E3B642':'#fff'} />
          <Text style={[styles.navText, activeTab==='home' && {color:'#E3B642'}]}>Jobs</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
          <Ionicons name="person" size={24} color={activeTab==='profile'?'#E3B642':'#fff'} />
          <Text style={[styles.navText, activeTab==='profile' && {color:'#E3B642'}]}>Profile</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  padding: { padding: 20, paddingBottom: 100 },
  
  // Auth & Welcome
  bgImage: { flex: 1, justifyContent: 'center' },
  overlay: { backgroundColor: 'rgba(46, 88, 52, 0.85)', flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  titleBig: { fontSize: 42, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
  glassCard: { backgroundColor: 'rgba(255,255,255,0.9)', width: '100%', padding: 25, borderRadius: 20 },
  roleBtn: { flexDirection: 'row', padding: 15, backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, alignItems:'center', borderWidth:1, borderColor:'#ddd' },
  roleText: { fontSize: 18, marginLeft: 15, fontWeight:'600', color:'#2E5834' },
  labelWhite: { color: '#333', fontSize:16, fontWeight:'bold', marginBottom:15, textAlign:'center' },
  
  header: { fontSize: 28, fontWeight: 'bold', color: '#2E5834', marginBottom: 5 },
  subHeader: { color: '#666', marginBottom: 30, fontSize:16 },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 15, fontSize:16 },
  btnMain: { backgroundColor: '#2E5834', padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#2E5834', shadowOpacity: 0.3, shadowRadius: 5, elevation:4 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // App Header
  topBar: { backgroundColor: '#2E5834', padding: 20, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems:'center' },
  appLogo: { color: '#fff', fontSize: 22, fontWeight: 'bold', letterSpacing:1 },

  // Cards
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 20, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:10, elevation:2 },
  cardHeader: { fontSize:18, fontWeight:'bold', color:'#333', marginBottom:15 },
  inputSmall: { backgroundColor: '#F9F9F9', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginBottom: 10 },
  
  // Job Listing
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 15, marginTop:10 },
  jobCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 15, flexDirection:'row', justifyContent:'space-between', alignItems:'center', shadowColor:'#000', shadowOpacity:0.05, shadowRadius:5, elevation:2, borderLeftWidth:4, borderLeftColor:'#E3B642' },
  jobTitle: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  jobSub: { color: '#666', fontSize:13 },
  applyBtn: { backgroundColor: '#E3B642', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  disabledBtn: { backgroundColor: '#ddd' },
  applyBtnText: { fontWeight: 'bold', color: '#2E5834', fontSize:12 },

  // Profile
  profileBox: { alignItems:'center', backgroundColor:'#fff', padding:20, borderRadius:20 },
  avatarCircle: { width:80, height:80, backgroundColor:'#F0F5F1', borderRadius:40, justifyContent:'center', alignItems:'center', marginBottom:20 },
  label: { alignSelf:'flex-start', marginLeft:5, marginBottom:5, fontWeight:'600', color:'#555', marginTop:10 },

  // Bottom Nav
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#2E5834', flexDirection: 'row', paddingVertical: 15, paddingHorizontal:30, justifyContent: 'space-around', borderTopLeftRadius:20, borderTopRightRadius:20 },
  navItem: { alignItems: 'center' },
  navText: { color: '#fff', fontSize: 11, marginTop: 4, fontWeight:'600' }
});