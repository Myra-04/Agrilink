import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, ImageBackground, SafeAreaView, ActivityIndicator, FlatList, Modal } from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker'; 
import { supabase } from './supabase'; 

export default function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [view, setView] = useState('welcome'); 
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');

  // Forms
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Worker Resume
  const [expYears, setExpYears] = useState('');
  const [expDetails, setExpDetails] = useState('');
  const [resumeFile, setResumeFile] = useState(null);

  // Data Lists
  const [jobs, setJobs] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [applicants, setApplicants] = useState([]);
  
  // Farmer Post Job
  const [jobTitle, setJobTitle] = useState('');
  const [jobLoc, setJobLoc] = useState('');
  const [jobPay, setJobPay] = useState('');
  const [jobDesc, setJobDesc] = useState('');

  // Chat State
  const [chatVisible, setChatVisible] = useState(false);
  const [activeAppId, setActiveAppId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => { checkUser(); }, []);

  // --- AUTH & PROFILE ---
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
      setFullName(data.full_name);
      if (data.role === 'worker' && !data.experience_years) setView('setup');
      else setView('home');
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { Alert.alert("Error", error.message); setLoading(false); }
    else { setSession(data.session); fetchProfile(data.session.user.id); }
  };

  const handleSignUp = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { Alert.alert("Error", error.message); setLoading(false); }
    else {
      await supabase.from('profiles').insert({ id: data.user.id, role: userRole, full_name: fullName });
      Alert.alert("Success", "Account Created! Please Login.");
      setView('login'); setLoading(false);
    }
  };

  // --- WORKER FEATURES ---
  const applyForJob = async (jobId) => {
    const { error } = await supabase.from('applications').insert({ job_id: jobId, worker_id: session.user.id });
    if (error) Alert.alert("Error", "You have already applied or something went wrong.");
    else Alert.alert("Success", "Application Sent! Wait for the farmer to accept.");
  };

  const fetchMyApplications = async () => {
    // Get jobs I applied to and their status
    const { data } = await supabase.from('applications')
      .select('*, jobs(title, farmer_id)')
      .eq('worker_id', session.user.id);
    if (data) setMyApplications(data);
  };

  // --- FARMER FEATURES ---
  const postJob = async () => {
    if (!jobTitle || !jobPay) return Alert.alert("Missing Info");
    await supabase.from('jobs').insert({
      title: jobTitle, location: jobLoc, pay_rate: jobPay, description: jobDesc, farmer_id: session.user.id
    });
    setJobTitle(''); setJobLoc(''); setJobPay(''); setJobDesc('');
    Alert.alert("Success", "Job Posted!");
    fetchFarmerJobs();
  };

  const fetchFarmerJobs = async () => {
    // Only fetch jobs created by THIS farmer
    const { data } = await supabase.from('jobs').select('*').eq('farmer_id', session.user.id);
    if (data) setJobs(data);
  };

  const viewApplicants = async (jobId) => {
    // Get all workers who applied to this job
    const { data } = await supabase.from('applications')
      .select('*, profiles(*)')
      .eq('job_id', jobId);
    if (data) {
      setApplicants(data);
      setView('applicants');
    }
  };

  const updateStatus = async (appId, status) => {
    await supabase.from('applications').update({ status: status }).eq('id', appId);
    Alert.alert("Updated", `Worker has been ${status}.`);
    // Refresh list
    const app = applicants.find(a => a.id === appId);
    if (app) viewApplicants(app.job_id);
  };

  // --- SHARED CHAT FEATURES ---
  const openChat = async (appId) => {
    setActiveAppId(appId);
    setChatVisible(true);
    fetchMessages(appId);
  };

  const fetchMessages = async (appId) => {
    const { data } = await supabase.from('messages').select('*').eq('application_id', appId).order('created_at');
    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    if (!newMessage) return;
    await supabase.from('messages').insert({
      application_id: activeAppId, sender_id: session.user.id, content: newMessage
    });
    setNewMessage('');
    fetchMessages(activeAppId);
  };

  // --- LOAD DATA ON HOME ---
  useEffect(() => {
    if (view === 'home' && session) {
      if (userRole === 'farmer') fetchFarmerJobs();
      else {
        // Worker sees ALL jobs
        supabase.from('jobs').select('*').then(({ data }) => setJobs(data || []));
        fetchMyApplications(); // Also load their status
      }
    }
  }, [view, session]);


  // --- RENDER HELPERS ---

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2E5834" /></View>;

  // 1. WELCOME & AUTH (Same as before)
  if (view === 'welcome') return (
    <ImageBackground source={{uri: 'https://images.unsplash.com/photo-1625246333195-98d804e9b371?q=80'}} style={styles.bgImage}>
      <View style={styles.overlay}>
        <Text style={styles.titleBig}>AgriLink</Text>
        <View style={styles.cardWhite}>
          <Text style={styles.label}>I am a...</Text>
          <TouchableOpacity style={styles.roleBtn} onPress={() => { setUserRole('farmer'); setView('login'); }}>
            <Ionicons name="leaf" size={24} color="#2E5834" /><Text style={styles.roleText}>Farmer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.roleBtn} onPress={() => { setUserRole('worker'); setView('login'); }}>
            <Ionicons name="hammer" size={24} color="#2E5834" /><Text style={styles.roleText}>Worker</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );

  if (view === 'login' || view === 'signup') return (
    <SafeAreaView style={styles.container}>
      <View style={styles.padding}>
        <TouchableOpacity onPress={() => setView('welcome')}><Ionicons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
        <Text style={styles.header}>{view === 'login' ? 'Login' : 'Create Account'}</Text>
        
        {view === 'signup' && <TextInput placeholder="Full Name" value={fullName} onChangeText={setFullName} style={styles.input} />}
        <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={styles.input} />
        <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
        
        {view === 'login' ? (
           <TouchableOpacity style={styles.btnMain} onPress={handleLogin}><Text style={styles.btnText}>Log In</Text></TouchableOpacity>
        ) : (
           <TouchableOpacity style={styles.btnMain} onPress={handleSignUp}><Text style={styles.btnText}>Sign Up</Text></TouchableOpacity>
        )}
        
        <TouchableOpacity onPress={() => setView(view === 'login' ? 'signup' : 'login')} style={{marginTop:20}}>
           <Text style={{textAlign:'center', color:'#2E5834'}}>
             {view === 'login' ? "New? Create Account" : "Have an account? Login"}
           </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // 2. WORKER SETUP (Same as before + File Logic)
  if (view === 'setup') return (
     <SafeAreaView style={styles.container}>
       <ScrollView contentContainerStyle={styles.padding}>
         <Text style={styles.header}>Build Profile</Text>
         <TextInput placeholder="Experience Years" value={expYears} onChangeText={setExpYears} style={styles.input} />
         <TextInput placeholder="Experience Details" value={expDetails} onChangeText={setExpDetails} multiline style={[styles.input, {height:80}]} />
         <TouchableOpacity style={styles.btnMain} onPress={async () => {
            await supabase.from('profiles').update({ experience_years: expYears, experience_details: expDetails }).eq('id', session.user.id);
            setView('home');
         }}>
           <Text style={styles.btnText}>Save Profile</Text>
         </TouchableOpacity>
       </ScrollView>
     </SafeAreaView>
  );

  // 3. FARMER: VIEW APPLICANTS
  if (view === 'applicants') return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setView('home')}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
        <Text style={styles.appLogo}>Applicants</Text>
        <View style={{width:24}} />
      </View>
      <FlatList 
        data={applicants}
        contentContainerStyle={styles.padding}
        renderItem={({item}) => (
          <View style={styles.card}>
            <Text style={styles.jobTitle}>{item.profiles.full_name}</Text>
            <Text>Exp: {item.profiles.experience_years}</Text>
            <Text style={{fontStyle:'italic', marginBottom:10}}>"{item.profiles.experience_details}"</Text>
            
            {/* Status Badge */}
            <Text style={{fontWeight:'bold', color: item.status==='accepted'?'green':item.status==='rejected'?'red':'orange'}}>
              Status: {item.status.toUpperCase()}
            </Text>

            {/* Actions */}
            <View style={{flexDirection:'row', marginTop:10, gap:10}}>
              {item.status === 'pending' && (
                <>
                  <TouchableOpacity style={[styles.smallBtn, {backgroundColor:'green'}]} onPress={() => updateStatus(item.id, 'accepted')}>
                    <Text style={styles.smallBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.smallBtn, {backgroundColor:'red'}]} onPress={() => updateStatus(item.id, 'rejected')}>
                    <Text style={styles.smallBtnText}>Reject</Text>
                  </TouchableOpacity>
                </>
              )}
              {item.status === 'accepted' && (
                <TouchableOpacity style={styles.smallBtn} onPress={() => openChat(item.id)}>
                  <Ionicons name="chatbubble" size={16} color="#2E5834" />
                  <Text style={styles.smallBtnText}> Chat</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />
      {/* CHAT MODAL */}
      <Modal visible={chatVisible} animationType="slide">
        <SafeAreaView style={{flex:1}}>
          <View style={[styles.topBar, {flexDirection:'row', alignItems:'center'}]}>
             <TouchableOpacity onPress={() => setChatVisible(false)}><Text style={{color:'white'}}>Close</Text></TouchableOpacity>
             <Text style={[styles.appLogo, {marginLeft:20}]}>Chat</Text>
          </View>
          <FlatList data={messages} contentContainerStyle={{padding:20}} renderItem={({item}) => (
             <View style={{alignSelf: item.sender_id === session.user.id ? 'flex-end' : 'flex-start', backgroundColor: item.sender_id === session.user.id ? '#E8F5E9' : '#eee', padding:10, borderRadius:10, marginBottom:5}}>
               <Text>{item.content}</Text>
             </View>
          )}/>
          <View style={{padding:10, flexDirection:'row', borderTopWidth:1, borderColor:'#ddd'}}>
             <TextInput placeholder="Type a message..." value={newMessage} onChangeText={setNewMessage} style={{flex:1, padding:10, borderWidth:1, borderColor:'#ddd', borderRadius:20}} />
             <TouchableOpacity onPress={sendMessage} style={{marginLeft:10, justifyContent:'center'}}><Ionicons name="send" size={24} color="#2E5834"/></TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

  // 4. MAIN DASHBOARD (Farmer & Worker)
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
         <Text style={styles.appLogo}>AgriLink {userRole === 'farmer' ? '(Manager)' : ''}</Text>
         <TouchableOpacity onPress={async () => { await supabase.auth.signOut(); setView('welcome'); }}>
           <Ionicons name="log-out-outline" size={24} color="white" />
         </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.padding}>
        
        {/* FARMER: POST JOB FORM */}
        {userRole === 'farmer' && (
          <View style={styles.cardWhite}>
            <Text style={styles.sectionTitle}>Post New Vacancy</Text>
            <TextInput placeholder="Job Title (e.g. Paddy Harvest)" value={jobTitle} onChangeText={setJobTitle} style={styles.inputSmall} />
            <TextInput placeholder="Location" value={jobLoc} onChangeText={setJobLoc} style={styles.inputSmall} />
            <TextInput placeholder="Pay Rate (e.g. RM 100/day)" value={jobPay} onChangeText={setJobPay} style={styles.inputSmall} />
            <TouchableOpacity style={styles.btnMain} onPress={postJob}><Text style={styles.btnText}>Post Job</Text></TouchableOpacity>
          </View>
        )}

        {/* WORKER: MY APPLICATIONS */}
        {userRole === 'worker' && (
          <View style={{marginBottom:20}}>
             <Text style={styles.sectionTitle}>My Applications</Text>
             {myApplications.length === 0 && <Text style={{color:'#666'}}>No applications yet.</Text>}
             {myApplications.map(app => (
               <View key={app.id} style={[styles.card, {borderLeftColor: app.status==='accepted'?'green':'orange'}]}>
                 <Text style={{fontWeight:'bold'}}>{app.jobs.title}</Text>
                 <Text>Status: {app.status.toUpperCase()}</Text>
                 {app.status === 'accepted' && (
                   <TouchableOpacity style={[styles.smallBtn, {marginTop:5}]} onPress={() => openChat(app.id)}>
                     <Text style={styles.smallBtnText}>Chat with Farmer</Text>
                   </TouchableOpacity>
                 )}
               </View>
             ))}
          </View>
        )}

        {/* JOB LISTINGS */}
        <Text style={styles.sectionTitle}>{userRole === 'farmer' ? 'My Posted Jobs' : 'Available Jobs'}</Text>
        {jobs.map(job => (
          <View key={job.id} style={styles.card}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            <Text style={{color:'#666'}}>📍 {job.location} • 💰 {job.pay_rate}</Text>
            
            {userRole === 'farmer' ? (
               <TouchableOpacity style={[styles.smallBtn, {marginTop:10}]} onPress={() => viewApplicants(job.id)}>
                 <Text style={styles.smallBtnText}>View Applicants</Text>
               </TouchableOpacity>
            ) : (
               <TouchableOpacity style={[styles.smallBtn, {marginTop:10}]} onPress={() => applyForJob(job.id)}>
                 <Text style={styles.smallBtnText}>Apply Now</Text>
               </TouchableOpacity>
            )}
          </View>
        ))}

      </ScrollView>

      {/* CHAT MODAL (Reused for Worker too) */}
      <Modal visible={chatVisible} animationType="slide">
        <SafeAreaView style={{flex:1}}>
          <View style={[styles.topBar, {flexDirection:'row', alignItems:'center'}]}>
             <TouchableOpacity onPress={() => setChatVisible(false)}><Text style={{color:'white'}}>Close</Text></TouchableOpacity>
             <Text style={[styles.appLogo, {marginLeft:20}]}>Chat</Text>
          </View>
          <FlatList data={messages} contentContainerStyle={{padding:20}} renderItem={({item}) => (
             <View style={{alignSelf: item.sender_id === session.user.id ? 'flex-end' : 'flex-start', backgroundColor: item.sender_id === session.user.id ? '#E8F5E9' : '#eee', padding:10, borderRadius:10, marginBottom:5}}>
               <Text>{item.content}</Text>
             </View>
          )}/>
          <View style={{padding:10, flexDirection:'row', borderTopWidth:1, borderColor:'#ddd'}}>
             <TextInput placeholder="Type a message..." value={newMessage} onChangeText={setNewMessage} style={{flex:1, padding:10, borderWidth:1, borderColor:'#ddd', borderRadius:20}} />
             <TouchableOpacity onPress={sendMessage} style={{marginLeft:10, justifyContent:'center'}}><Ionicons name="send" size={24} color="#2E5834"/></TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7F4' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  padding: { padding: 20 },
  bgImage: { flex: 1, justifyContent: 'center' },
  overlay: { backgroundColor: 'rgba(0,0,0,0.6)', flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  titleBig: { fontSize: 40, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  cardWhite: { backgroundColor: '#fff', width: '100%', padding: 20, borderRadius: 15, marginBottom:20 },
  roleBtn: { flexDirection: 'row', padding: 15, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, marginBottom: 10, alignItems:'center' },
  roleText: { fontSize: 18, marginLeft: 10 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#2E5834', marginBottom: 20 },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginBottom:15 },
  inputSmall: { backgroundColor: '#F9F9F9', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginBottom:10 },
  btnMain: { backgroundColor: '#2E5834', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  topBar: { backgroundColor: '#2E5834', padding: 20, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between' },
  appLogo: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, elevation: 2, borderLeftWidth:5, borderLeftColor:'#2E5834' },
  jobTitle: { fontSize: 16, fontWeight: 'bold', color: '#2E5834' },
  smallBtn: { backgroundColor: '#E3B642', padding: 8, borderRadius: 5, alignSelf: 'flex-start', flexDirection:'row' },
  smallBtnText: { fontSize: 12, fontWeight: 'bold', color: '#2E5834' }
});