"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DeploymentConfig,
  DeploymentSourceId,
  DeploymentStatus,
  PreDeployStep,
} from "../pre-deploy/pre-deploy-model";
import {
  SERVICE_CHOICES,
  buildNewService,
  cloneDefaultServices,
  cloneDeploymentConfig,
  isDatabase,
  makeServiceId,
  parseStoredServices,
  parseStoredWorkflow,
  serviceStorageKey,
  workflowStorageKey,
  type ServiceChoice,
  type ServiceNode,
  type StoredWorkflow,
  type TabLabel,
  type WorkflowMode,
} from "./service-overview-model";

/**
 * Controller for the service overview: owns the canvas services, the
 * pre-deployment workflow, simulated deployment timers, toasts, and the
 * localStorage sync for both stores. The component tree stays presentational.
 */
export function useServiceOverview(projectId: string) {
  const projectServiceStorageKey = serviceStorageKey(projectId);
  const projectWorkflowStorageKey = workflowStorageKey(projectId);
  const [services, setServices] = useState<ServiceNode[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabLabel>("Deployments");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsServiceId, setLogsServiceId] = useState<string | undefined>(undefined);
  const [deployProgress, setDeployProgress] = useState<{ progress: number; label: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>("source");
  const [selectedSource, setSelectedSource] = useState<DeploymentSourceId | null>(null);
  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig>(() => cloneDeploymentConfig());
  const [preDeployStatus, setPreDeployStatus] = useState<DeploymentStatus>("Queued");
  const [workflowStorageReady, setWorkflowStorageReady] = useState(false);
  const deploymentTimersRef = useRef<number[]>([]);
  const servicesRef = useRef(services);
  servicesRef.current = services;
  const storageReadyRef = useRef(false);

  useEffect(() => {
    const stored = parseStoredServices(window.localStorage.getItem(projectServiceStorageKey));
    setServices(stored ?? []);
    storageReadyRef.current = true;
    setStorageReady(true);
  }, [projectId, projectServiceStorageKey]);

  useEffect(() => {
    if (!storageReady) return;
    // Dragging writes positions on every pointermove; a trailing debounce keeps
    // the synchronous stringify + setItem off the per-frame path.
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(projectServiceStorageKey, JSON.stringify(servicesRef.current));
      } catch {
        // Keep the console usable when storage is blocked or full.
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [projectServiceStorageKey, services, storageReady]);

  // Flush whatever the debounce has not written yet when leaving the page or
  // switching projects.
  useEffect(() => {
    const key = projectServiceStorageKey;
    return () => {
      if (!storageReadyRef.current) return;
      try {
        window.localStorage.setItem(key, JSON.stringify(servicesRef.current));
      } catch {
        // Keep the console usable when storage is blocked or full.
      }
    };
  }, [projectServiceStorageKey]);

  useEffect(() => {
    const stored = parseStoredWorkflow(window.localStorage.getItem(projectWorkflowStorageKey));
    if (stored) {
      setWorkflowMode(stored.mode);
      setSelectedSource(stored.source);
      setDeploymentConfig(stored.config);
      setPreDeployStatus(stored.status);
    } else {
      setWorkflowMode("source");
      setSelectedSource(null);
      setDeploymentConfig(cloneDeploymentConfig());
      setPreDeployStatus("Queued");
    }
    setWorkflowStorageReady(true);
  }, [projectId, projectWorkflowStorageKey]);

  useEffect(() => {
    if (!workflowStorageReady) return;
    try {
      const stored: StoredWorkflow = {
        mode: workflowMode,
        source: selectedSource,
        config: deploymentConfig,
        status: preDeployStatus,
      };
      window.localStorage.setItem(projectWorkflowStorageKey, JSON.stringify(stored));
    } catch {
      // Keep the console usable when storage is blocked or full.
    }
  }, [deploymentConfig, preDeployStatus, projectWorkflowStorageKey, selectedSource, workflowMode, workflowStorageReady]);

  useEffect(() => () => {
    deploymentTimersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, [projectId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  const logsService = useMemo(
    () => services.find((service) => service.id === logsServiceId) ?? null,
    [services, logsServiceId],
  );

  const deploymentStatus = useMemo(() => {
    if (deployProgress) return "Building";
    if (!services.length) return "Empty";
    if (services.some((service) => service.status === "failed")) return "Failed";
    if (services.every((service) => service.status === "stopped")) return "Stopped";
    return "Live";
  }, [deployProgress, services]);

  const isPreDeploy = workflowMode !== "overview";
  const preDeployStep: PreDeployStep = workflowMode === "overview" ? "source" : workflowMode;

  const clearPreDeployTimers = useCallback(() => {
    deploymentTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    deploymentTimersRef.current = [];
  }, []);

  const trackTimer = useCallback((timer: number) => {
    deploymentTimersRef.current.push(timer);
  }, []);

  const startDeployment = useCallback((serviceId?: string) => {
    if (!services.length) {
      setAddDialogOpen(true);
      return;
    }

    setDeployProgress({ progress: 18, label: "Deploying" });
    setServices((current) => current.map((service) => {
      if (serviceId && service.id !== serviceId) return service;
      return { ...service, status: "building" };
    }));

    trackTimer(window.setTimeout(() => setDeployProgress({ progress: 46, label: "Building" }), 420));
    trackTimer(window.setTimeout(() => setDeployProgress({ progress: 78, label: "Health check" }), 980));
    trackTimer(window.setTimeout(() => {
      setServices((current) => current.map((service) => {
        if (serviceId && service.id !== serviceId) return service;
        return { ...service, status: isDatabase(service) ? "available" : "live" };
      }));
      setDeployProgress(null);
      setToast(serviceId ? "Service redeployed successfully" : "Deployment completed successfully");
    }, 1540));
  }, [services.length, trackTimer]);

  const updateDeploymentConfig = useCallback(<K extends keyof DeploymentConfig>(key: K, value: DeploymentConfig[K]) => {
    setDeploymentConfig((current) => ({ ...current, [key]: value }));
  }, []);

  const addEnvironmentVariable = useCallback(() => {
    setDeploymentConfig((current) => ({
      ...current,
      envVariables: [...current.envVariables, { id: `variable-${Date.now()}-${current.envVariables.length}`, key: "", value: "" }],
    }));
  }, []);

  const removeEnvironmentVariable = useCallback((id: string) => {
    setDeploymentConfig((current) => ({
      ...current,
      envVariables: current.envVariables.filter((variable) => variable.id !== id),
    }));
  }, []);

  const updateEnvironmentVariable = useCallback((id: string, field: "key" | "value", value: string) => {
    setDeploymentConfig((current) => ({
      ...current,
      envVariables: current.envVariables.map((variable) => variable.id === id ? { ...variable, [field]: value } : variable),
    }));
  }, []);

  const startPreDeploy = useCallback(() => {
    if (!selectedSource) return;

    clearPreDeployTimers();
    setWorkflowMode("deploy");
    setPreDeployStatus("Queued");

    const setStatusAfter = (status: DeploymentStatus, delay: number) => {
      trackTimer(window.setTimeout(() => setPreDeployStatus(status), delay));
    };

    setStatusAfter("Building", 520);
    setStatusAfter("Deploying", 1260);
    setStatusAfter("Live", 2220);

    const finishTimer = window.setTimeout(() => {
      const choice = SERVICE_CHOICES.find((item) => item.id === selectedSource) ?? SERVICE_CHOICES[0];
      const id = makeServiceId(choice, []);
      const createdService = buildNewService(choice, [], id);
      const service: ServiceNode = {
        ...createdService,
        status: isDatabase(createdService) ? "available" : "live",
        endpoint: `Port ${deploymentConfig.port || "8080"}`,
        branch: choice.source ? (deploymentConfig.branch || "main") : undefined,
      };

      setServices([service]);
      setSelectedServiceId(null);
      setPreDeployStatus("Live");
      setWorkflowMode("overview");
      setActiveTab("Overview");
      setToast("Deployment completed successfully");
      deploymentTimersRef.current = [];
    }, 3220);
    deploymentTimersRef.current.push(finishTimer);
  }, [clearPreDeployTimers, deploymentConfig.branch, deploymentConfig.port, selectedSource]);

  const simulateFailedDeployment = useCallback(() => {
    clearPreDeployTimers();
    setWorkflowMode("deploy");
    setPreDeployStatus("Failed");
    setToast("Deployment failed — review the build output");
  }, [clearPreDeployTimers]);

  const openServiceOverview = useCallback(() => {
    clearPreDeployTimers();
    setPreDeployStatus("Live");
    setWorkflowMode("overview");
    setActiveTab("Overview");
  }, [clearPreDeployTimers]);

  const handlePreDeployContinue = useCallback(() => {
    if (workflowMode === "source") {
      if (!selectedSource) return;
      setWorkflowMode("configure");
      return;
    }

    if (workflowMode === "configure") startPreDeploy();
  }, [selectedSource, startPreDeploy, workflowMode]);

  const handlePreDeployBack = useCallback(() => {
    if (workflowMode === "configure") {
      setWorkflowMode("source");
      return;
    }

    if (workflowMode === "deploy") {
      clearPreDeployTimers();
      setPreDeployStatus("Queued");
      setWorkflowMode("configure");
    }
  }, [clearPreDeployTimers, workflowMode]);

  const handleHeaderDeploy = useCallback(() => {
    if (!isPreDeploy) {
      startDeployment();
      return;
    }

    if (workflowMode === "source" && selectedSource) {
      setWorkflowMode("configure");
    } else if (workflowMode === "configure") {
      startPreDeploy();
    }
  }, [isPreDeploy, selectedSource, startDeployment, startPreDeploy, workflowMode]);

  const restartService = useCallback((id: string) => {
    setServices((current) => current.map((service) => service.id === id ? { ...service, status: "building" } : service));
    setDeployProgress({ progress: 42, label: "Restarting" });
    trackTimer(window.setTimeout(() => {
      setServices((current) => current.map((service) => service.id === id ? { ...service, status: isDatabase(service) ? "available" : "live" } : service));
      setDeployProgress(null);
      setToast("Service restarted");
    }, 1100));
  }, [trackTimer]);

  const stopService = useCallback((id: string) => {
    setServices((current) => current.map((service) => service.id === id ? { ...service, status: "stopped" } : service));
    setToast("Service stopped");
  }, []);

  const handleNodeAction = useCallback((id: string, action: "logs" | "redeploy" | "restart" | "stop" | "settings") => {
    setSelectedServiceId(id);
    if (action === "logs") {
      setLogsServiceId(id);
      setLogsOpen(true);
    } else if (action === "redeploy") {
      startDeployment(id);
    } else if (action === "restart") {
      restartService(id);
    } else if (action === "stop") {
      stopService(id);
    } else {
      setSettingsOpen(true);
    }
  }, [restartService, startDeployment, stopService]);

  const handleAddChoice = useCallback((choice: ServiceChoice) => {
    if (isPreDeploy) {
      setSelectedSource(choice.id as DeploymentSourceId);
      setWorkflowMode("source");
      setActiveTab("Deployments");
      setAddDialogOpen(false);
      setToast(`${choice.label} selected as the deployment source`);
      return;
    }

    const id = makeServiceId(choice, services);
    const service = buildNewService(choice, services, id);
    setServices((current) => [...current, buildNewService(choice, current, id)]);
    setAddDialogOpen(false);
    setSelectedServiceId(id);
    setMobilePanelOpen(true);
    setToast(`${service.name} added to the canvas`);

    if (service.status === "building") {
      trackTimer(window.setTimeout(() => {
        setServices((current) => current.map((item) => item.id === id ? { ...item, status: "live" } : item));
        setToast(`${service.name} is live`);
      }, 1350));
    }
  }, [isPreDeploy, services, trackTimer]);

  const handleTabClick = useCallback((tab: TabLabel) => {
    setActiveTab(tab);
    if (tab === "Logs") {
      setLogsServiceId(selectedServiceId ?? undefined);
      setLogsOpen(true);
    } else if (tab === "Settings") {
      setSettingsOpen(true);
    } else if (tab !== "Overview") {
      setToast(`${tab} view is coming soon`);
    }
  }, [selectedServiceId]);

  const updateServiceStatus = useCallback((status: ServiceNode["status"]) => {
    if (!selectedServiceId) return;
    setServices((current) => current.map((service) => service.id === selectedServiceId ? { ...service, status } : service));
  }, [selectedServiceId]);

  const updateServicePosition = useCallback((id: string, position: { x: number; y: number }) => {
    setServices((current) => current.map((service) => service.id === id ? { ...service, position } : service));
  }, []);

  const clearServices = useCallback(() => {
    setServices([]);
    setSelectedServiceId(null);
    setMobilePanelOpen(false);
    setSettingsOpen(false);
    setToast("Canvas cleared — choose a source to start again");
  }, []);

  const loadDemoServices = useCallback(() => {
    setServices(cloneDefaultServices());
    setSettingsOpen(false);
    setToast("Deployed service demo restored");
  }, []);

  const selectSource = useCallback((source: DeploymentSourceId) => {
    setSelectedSource(source);
  }, []);

  const selectService = useCallback((id: string) => {
    setSelectedServiceId(id);
  }, []);

  const openLogs = useCallback((id?: string) => {
    setLogsServiceId(id);
  }, []);

  return {
    // canvas & panel
    services,
    selectedService,
    selectedServiceId,
    selectService,
    openLogs,
    mobilePanelOpen,
    setMobilePanelOpen,
    deploymentStatus,
    deployProgress,
    updateServicePosition,
    // tabs
    activeTab,
    handleTabClick,
    // dialogs
    addDialogOpen,
    setAddDialogOpen,
    settingsOpen,
    setSettingsOpen,
    logsOpen,
    setLogsOpen,
    logsService,
    handleNodeAction,
    handleAddChoice,
    startDeployment,
    updateServiceStatus,
    clearServices,
    loadDemoServices,
    // pre-deploy workflow
    isPreDeploy,
    preDeployStep,
    workflowMode,
    selectedSource,
    selectSource,
    deploymentConfig,
    updateDeploymentConfig,
    addEnvironmentVariable,
    removeEnvironmentVariable,
    updateEnvironmentVariable,
    preDeployStatus,
    handlePreDeployContinue,
    handlePreDeployBack,
    startPreDeploy,
    openServiceOverview,
    simulateFailedDeployment,
    handleHeaderDeploy,
    // toast
    toast,
  };
}
