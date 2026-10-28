import test from 'node:test';
import assert from 'node:assert/strict';
import { educationEmail, validOtp, passwordError, registrationError, googleErrorMessage } from '../src/api/auth-policy.ts';
const profile={fullName:'Sinh viên thử',email:'student@school.edu.vn',studentId:'SV-123',university:'DNTU',password:'TestPass123',confirmPassword:'TestPass123'};
test('registration preserves school-vs-personal email verification rules and requires a student-card for personal addresses',()=>{
 assert.equal(educationEmail(profile.email),true);assert.equal(educationEmail('a@school.edu'),true);
 for(const email of ['a@gmail.com','a@edu.vn.evil.invalid','a@notedu.vn','a@edu.vn'])assert.equal(educationEmail(email),false,email);
 assert.equal(registrationError(profile,false),'');assert.match(registrationError({...profile,email:'a@gmail.com'},false),/ảnh thẻ/);
 assert.equal(registrationError({...profile,email:'a@gmail.com'},true),'');
 for(const update of [{fullName:'a'},{studentId:'../'},{university:''},{email:'bad'},{password:'12345678'},{confirmPassword:'Mismatch123'}])assert.ok(registrationError({...profile,...update},true));
});
test('OTP is exactly six digits including leading zeroes and reset password follows server rules',()=>{
 assert.equal(validOtp('012345'),true);for(const code of ['12345','1234567','abcdef','12 345'])assert.equal(validOtp(code),false);
 assert.equal(passwordError('Valid123','Valid123'),'');assert.ok(passwordError('no-digits','no-digits'));assert.ok(passwordError('Valid123','Other123'));
 assert.match(googleErrorMessage('school_google'),/Workspace/);assert.match(googleErrorMessage('email_exists'),/mật khẩu/);
});
