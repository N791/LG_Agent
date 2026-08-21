{{/*
Expand the name of the chart.
*/}}
{{- define "lg-agent.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "lg-agent.labels" -}}
app.kubernetes.io/name: {{ include "lg-agent.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Values.global.releaseVersion | quote }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
{{- end }}

{{- define "lg-agent.componentLabels" -}}
{{ include "lg-agent.labels" .root }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{- define "lg-agent.imageTag" -}}
{{- default .root.Values.global.imageTag .image.tag -}}
{{- end }}

{{- define "lg-agent.secretName" -}}
{{- required "secrets.existingSecret is required; provision it directly or with External Secrets before deployment" .Values.secrets.existingSecret -}}
{{- end }}

{{- define "lg-agent.imagePullSecrets" -}}
{{- with .Values.global.imagePullSecrets }}
imagePullSecrets:
{{- toYaml . | nindent 2 }}
{{- end }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "lg-agent.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}
