import React, { useState } from "react";
import Charts from "./charts";
import ApproveReport from "./ApproveReport";
import CreateListing from "./CreateListing";
import History from "./History";
import DisplayAllWorkers from "./displayAllWorkers";
import AdminCameraPage from "./AdminCameraPage";
import TaskStatsPage from "./TaskStatsPage";
import TaskAssignmentPage from "./TaskAssignmentPage";
import WorkerTaskPage from "./WorkerTaskPage";
import { BarChart2, FileText, ShoppingBag, Map, Menu, X, HardHat, Camera, BarChart3, ClipboardList, CheckSquare } from "lucide-react";


function Sidebar({ isOpen, toggleSidebar, setActiveComponent }) {
  const menuItems = [
    { icon: BarChart2, text: "Charts", component: "Charts" },
    { icon: FileText, text: "Reports", component: "ApproveReport" },
    { icon: ShoppingBag, text: "Marketplace", component: "Marketplace" },
    { icon: Map, text: "Purchase History", component: "History" },
    { icon: HardHat, text: "Workers", component: "DisplayAllWorkers" },
    { icon: Camera, text: "Camera", component: "Camera" },
    { icon: BarChart3, text: "Task Stats", component: "TaskStats" },
    { icon: ClipboardList, text: "Task Assignments", component: "TaskAssignments" },
    { icon: CheckSquare, text: "Task Completion", component: "WorkerTasks" },
  ];

  const handleItemClick = (componentName) => {
    setActiveComponent(componentName);
    toggleSidebar(false);
  };

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => toggleSidebar(false)}
        />
      )}

      {/* Sidebar — fixed on mobile, static in flex on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-50 bg-black border-r border-gray-700 shadow-lg p-4 transition-transform duration-300 w-64 h-screen
          md:static md:z-auto md:translate-x-0 md:flex md:flex-col md:shrink-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Close Button (mobile only) */}
        <button
          onClick={() => toggleSidebar(false)}
          className="md:hidden absolute top-4 right-4 p-2 text-red-500 hover:text-red-700"
        >
          <X className="w-6 h-6" />
        </button>

        <nav>
          <ul className="space-y-4 mt-8">
            {menuItems.map((item) => (
              <li key={item.text}>
                <button
                  onClick={() => handleItemClick(item.component)}
                  className="flex items-center space-x-4 p-3 w-full text-left rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-all duration-300"
                >
                  <item.icon className="w-6 h-6 text-gray-400 hover:text-white" />
                  <span className="text-lg">{item.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}

const AdminDashboard = () => {
  const [activeComponent, setActiveComponent] = useState("Charts");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="bg-black flex min-h-screen">
      <Sidebar
        isOpen={sidebarOpen}
        toggleSidebar={setSidebarOpen}
        setActiveComponent={setActiveComponent}
      />
      <div className="flex-1 flex flex-col bg-black min-w-0">
        {/* Hamburger — only visible on mobile, sits above content */}
        <div className="md:hidden p-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 bg-gray-800 text-white rounded-lg focus:outline-none"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
        <main className="flex-1 bg-black text-white px-4 md:px-8 py-6">
          {activeComponent === "Charts" && <Charts />}
          {activeComponent === "ApproveReport" && <ApproveReport />}
          {activeComponent === "Marketplace" && <CreateListing />}
          {activeComponent === "History" && <History />}
          {activeComponent === "DisplayAllWorkers" && <DisplayAllWorkers />}
          {activeComponent === "Camera" && <AdminCameraPage />}
          {activeComponent === "TaskStats" && <TaskStatsPage />}
          {activeComponent === "TaskAssignments" && <TaskAssignmentPage />}
          {activeComponent === "WorkerTasks" && <WorkerTaskPage />}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;

