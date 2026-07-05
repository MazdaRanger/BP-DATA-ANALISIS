# Script untuk deploy Firestore Security Rules
# Jalankan script ini di PowerShell untuk memperbaiki permission error

Write-Host "=== Deploy Firestore Rules ===" -ForegroundColor Cyan
Write-Host "Login ke Firebase CLI..." -ForegroundColor Yellow

firebase login

Write-Host ""
Write-Host "Deploy rules ke Firebase project..." -ForegroundColor Yellow

firebase deploy --only firestore:rules --project gen-lang-client-0300801049

Write-Host ""
Write-Host "Selesai! Coba simpan pengaturan kembali di aplikasi." -ForegroundColor Green
